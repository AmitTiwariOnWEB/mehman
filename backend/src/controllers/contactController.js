import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const normalizePhone = (value) =>
  String(value || "")
    .replace(/[^\d+]/g, "")
    .replace(/(?!^)\+/g, "");

export const syncContactsSchema = z.object({
  body: z.object({
    contacts: z
      .array(
        z.object({
          displayName: z.string().trim().max(160).optional(),
          phone: z.string().trim().min(3).max(60),
          label: z.string().trim().max(60).optional(),
          rawId: z.string().trim().max(120).optional()
        })
      )
      .max(1000)
  })
});

export const syncContacts = asyncHandler(async (req, res) => {
  const uniqueContacts = new Map();
  let skipped = 0;

  for (const item of req.validated.body.contacts) {
    const normalizedPhone = normalizePhone(item.phone);
    const digitCount = normalizedPhone.replace(/\D/g, "").length;

    if (!normalizedPhone || digitCount < 3) {
      skipped += 1;
      continue;
    }

    if (!uniqueContacts.has(normalizedPhone)) {
      uniqueContacts.set(normalizedPhone, {
        displayName: item.displayName || normalizedPhone,
        phone: item.phone,
        normalizedPhone,
        label: item.label || null,
        rawId: item.rawId || null
      });
    }
  }

  const contacts = [...uniqueContacts.values()];

  if (contacts.length > 0) {
    await prisma.$transaction(
      contacts.map((contact) =>
        prisma.phoneContact.upsert({
          where: {
            userId_normalizedPhone: {
              userId: req.user.id,
              normalizedPhone: contact.normalizedPhone
            }
          },
          create: {
            ...contact,
            userId: req.user.id
          },
          update: {
            displayName: contact.displayName,
            phone: contact.phone,
            label: contact.label,
            rawId: contact.rawId
          }
        })
      )
    );
  }

  res.json({ synced: contacts.length, skipped });
});
