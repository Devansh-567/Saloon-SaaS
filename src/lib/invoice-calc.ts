# Copyright (c) 2026 Devansh Singh
# All Rights Reserved.
#
# This software and its source code are proprietary
# and confidential property of Guru AI Technologies.
#
# Unauthorized copying, modification, distribution,
# or use of this software, in whole or in part,
# is strictly prohibited without prior written
# permission from Guru AI Technologies.
 import { roundMoney } from "./utils";

export type CalcLineInput = {
  quantity: number;
  unitPrice: number;
  taxRate: number;
  commissionRate: number;
};

export function calculateInvoice<T extends CalcLineInput>(lines: T[], requestedDiscount: number) {
  if (!lines.length) throw new Error("At least one line is required");
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + roundMoney(line.quantity * line.unitPrice), 0));
  const discount = roundMoney(Math.min(Math.max(0, requestedDiscount), subtotal));
  let allocated = 0;
  const calculated = lines.map((line, index) => {
    const gross = roundMoney(line.quantity * line.unitPrice);
    const share =
      index === lines.length - 1
        ? roundMoney(discount - allocated)
        : subtotal > 0
          ? roundMoney((gross / subtotal) * discount)
          : 0;
    allocated = roundMoney(allocated + share);
    const netBase = roundMoney(Math.max(0, gross - share));
    const taxAmount = roundMoney((netBase * line.taxRate) / 100);
    const lineTotal = roundMoney(netBase + taxAmount);
    const commissionAmount = roundMoney((netBase * line.commissionRate) / 100);
    return {
      ...line,
      gross,
      discountAmount: share,
      netBase,
      taxAmount,
      lineTotal,
      commissionAmount,
    };
  });
  const taxTotal = roundMoney(calculated.reduce((sum, line) => sum + line.taxAmount, 0));
  const total = roundMoney(calculated.reduce((sum, line) => sum + line.lineTotal, 0));
  const commissionTotal = roundMoney(calculated.reduce((sum, line) => sum + line.commissionAmount, 0));
  return { subtotal, discount, taxTotal, total, commissionTotal, lines: calculated };
}

