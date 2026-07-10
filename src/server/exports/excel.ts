import ExcelJS from "exceljs";

import { archiveInDrive, downloadFromDrive } from "@/server/documents/drive";
import { prisma } from "@/server/db/client";
import { getGeneralSettings } from "@/server/settings/service";

const headers = ["Patient Name", "Centre", "Procedure", "Procedure Details", "Discharge Date", "Payment Type", "Beneficiary Type", "Beneficiary Name", "Beneficiary Contact", "Referral Hospital", "Referral Detail", "Referral Amount", "Status", "Received Date", "Gmail Thread"];

function worksheetName(centreName: string) {
  return centreName.replace(/[\\/?*\[\]:]/g, " ").slice(0, 31) || "Unassigned";
}

function styleWorksheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF115D4D" } };
  sheet.getRow(1).alignment = { vertical: "middle" };
  sheet.columns = headers.map((header) => ({ header, key: header, width: header === "Referral Detail" || header === "Procedure Details" ? 28 : 18 }));
}

export async function createMonthlyExport(month: number, year: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) throw new Error("Choose a valid export month and year.");
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1));
  const [settings, profile, requests] = await Promise.all([
    getGeneralSettings(),
    prisma.exportProfile.findFirst({ where: { isDefault: true } }),
    prisma.referralRequest.findMany({
      where: { receivedAt: { gte: periodStart, lt: periodEnd } },
      include: { centre: true, beneficiaries: true, gmailThread: true },
      orderBy: [{ centre: { name: "asc" } }, { receivedAt: "asc" }],
    }),
  ]);
  const exportProfile = profile
    ? await prisma.exportProfile.update({ where: { id: profile.id }, data: { templateDriveFileId: settings.exportTemplateDriveFileId || null } })
    : await prisma.exportProfile.create({ data: { name: "Default Referral Export", isDefault: true, templateDriveFileId: settings.exportTemplateDriveFileId || null, configuration: {} } });
  const job = await prisma.exportJob.create({ data: { exportProfileId: exportProfile.id, periodStart, periodEnd, status: "RUNNING" } });
  try {
    const workbook = new ExcelJS.Workbook();
    if (exportProfile.templateDriveFileId) {
      await workbook.xlsx.load(await downloadFromDrive(exportProfile.templateDriveFileId) as never);
    }
    const grouped = requests.reduce<Map<string, typeof requests>>((result, request) => {
      const centreName = worksheetName(request.centre?.name ?? request.centreRaw ?? "Unassigned");
      result.set(centreName, [...(result.get(centreName) ?? []), request]);
      return result;
    }, new Map());
    for (const [centreName, centreRequests] of grouped) {
      const sheet = workbook.getWorksheet(centreName) ?? workbook.addWorksheet(centreName);
      if (sheet.rowCount === 0) styleWorksheet(sheet);
      for (const request of centreRequests ?? []) {
        const beneficiaries = request.beneficiaries.length ? request.beneficiaries : [null];
        for (const beneficiary of beneficiaries) {
          sheet.addRow({
            "Patient Name": request.patientName ?? "",
            Centre: request.centre?.name ?? request.centreRaw ?? "",
            Procedure: request.procedure ?? "",
            "Procedure Details": request.procedureDetails ?? "",
            "Discharge Date": request.dischargeDate?.toISOString().slice(0, 10) ?? "",
            "Payment Type": request.paymentType ?? "",
            "Beneficiary Type": beneficiary?.type.replaceAll("_", " ") ?? "",
            "Beneficiary Name": beneficiary?.name ?? "",
            "Beneficiary Contact": beneficiary?.contact ?? "",
            "Referral Hospital": request.referralHospital ?? "",
            "Referral Detail": request.referralDetail ?? "",
            "Referral Amount": beneficiary?.referralAmount ? Number(beneficiary.referralAmount) : Number(request.totalReferralAmount ?? 0),
            Status: request.status.replaceAll("_", " "),
            "Received Date": request.receivedAt.toISOString().slice(0, 10),
            "Gmail Thread": request.gmailThread.gmailThreadId,
          });
        }
      }
    }
    const filename = `KHOPS-Referral-Incentives-${year}-${String(month).padStart(2, "0")}.xlsx`;
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
    const driveFileId = settings.exportDriveFolderId ? await archiveInDrive({ filename, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer, folderId: settings.exportDriveFolderId }) : null;
    await prisma.exportJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", filename, googleDriveFileId: driveFileId, completedAt: new Date() } });
    return { filename, buffer };
  } catch (error) {
    await prisma.exportJob.update({ where: { id: job.id }, data: { status: "FAILED", error: { message: error instanceof Error ? error.message : "Export failed" }, completedAt: new Date() } });
    throw error;
  }
}
