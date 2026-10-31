import { prisma } from "../config/prisma.js";

const ONE_MINUTE_MS = 60 * 1000;
let lifecycleTimer = null;

const asObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

const runLifecycleTick = async () => {
  const now = new Date();

  const checkedInToAutoCheckout = await prisma.gatepass.findMany({
    where: {
      status: "CHECKED_IN",
      checkedOutAt: null,
      validUntil: { lte: now }
    },
    include: { visitor: true, branch: true }
  });

  for (const gatepass of checkedInToAutoCheckout) {
    const warningText = "No checkout pass scanned, so auto checkout was applied.";
    const nextMetadata = {
      ...asObject(gatepass.metadata),
      autoCheckoutWarning: warningText,
      autoCheckoutAt: now.toISOString(),
      autoCheckoutReason: "NO_CHECKOUT_SCAN"
    };

    await prisma.$transaction(async (tx) => {
      const updated = await tx.gatepass.update({
        where: { id: gatepass.id },
        data: {
          status: "CHECKED_OUT",
          checkedOutAt: now,
          metadata: nextMetadata
        },
        include: { visitor: true, branch: true }
      });

      const notifyUserId = updated.metadata?.targetOwnerId || updated.approvedById || updated.visitor?.createdById;
      if (notifyUserId) {
        await tx.notification.create({
          data: {
            companyId: updated.companyId,
            userId: notifyUserId,
            title: "Visitor auto checked out",
            body: `${updated.visitor.fullName} auto checked out at ${updated.branch.name}. ${warningText}`,
            status: "SENT",
            channel: "IN_APP",
            data: { gatepassId: updated.id, visitorId: updated.visitorId, action: "AUTO_CHECKOUT" }
          }
        });
      }
    });
  }

  await prisma.gatepass.updateMany({
    where: {
      status: { in: ["ACTIVE", "DRAFT"] },
      validUntil: { lte: now }
    },
    data: { status: "EXPIRED" }
  });
};

export const startGatepassLifecycleJobs = () => {
  if (lifecycleTimer) return;

  runLifecycleTick().catch((error) => {
    console.error("Gatepass lifecycle startup tick failed", error);
  });

  lifecycleTimer = setInterval(() => {
    runLifecycleTick().catch((error) => {
      console.error("Gatepass lifecycle tick failed", error);
    });
  }, ONE_MINUTE_MS);

  lifecycleTimer.unref?.();
};

export const stopGatepassLifecycleJobs = () => {
  if (!lifecycleTimer) return;
  clearInterval(lifecycleTimer);
  lifecycleTimer = null;
};

export const runGatepassLifecycleNow = runLifecycleTick;
