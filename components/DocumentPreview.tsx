import * as React from "react";
import Image from "next/image";

type PreviewItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount?: number;
};

type PreviewCustomer = {
  name: string;
  phone?: string;
  address?: string;
};

type DocumentPreviewProps = {
  docType: string;
  docNumber: string;
  issueDate: string; // ISO string
  customer: PreviewCustomer | null;
  items: PreviewItem[];
  currency?: string; // e.g. "MYR"
};

const formatCurrency = (value: number, currency: string) =>
  `RM ${Number(value || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function DocumentPreview({
  docType,
  docNumber,
  issueDate,
  customer,
  items,
  currency = "MYR",
}: DocumentPreviewProps) {
  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      Number(
        item.amount ??
          Number(item.quantity || 0) * Number(item.unitPrice || 0)
      ),
    0
  );
  const total = subtotal;

  return (
    <div className="document-preview bg-white text-gray-900 w-[794px] mx-auto px-20 py-12 shadow-sm print:shadow-none print:w-full">
      {/* Header */}
      <div className="space-y-1 leading-tight text-gray-800">
        <div className="font-semibold text-[22px] text-gray-900">PERABOT MEGAH ENTERPRISE</div>
        <div className="text-xs">NO. 202503044871 (JR0174054-W)</div>
        <div className="text-xs">NO.12 , TAMAN PERDANA , JALAN BAKRI , 84000 MUAR, JOHOR.</div>
        <div className="text-xs mt-1">perabotmegah@gmail.com</div>
      </div>

      {/* Billing */}
      <div className="mt-6 space-y-4">
        <div className="text-[18px] font-bold tracking-tight">{docType}</div>
        <div className="grid grid-cols-2 gap-6 items-start mb-3">
          <div className="space-y-1">
            <div className="text-xs uppercase text-gray-500">To</div>
            {customer ? (
              <>
                <div className="text-sm font-normal text-gray-900">{customer.name}</div>
                {customer.phone && (
                  <div className="text-sm font-normal text-gray-900">{customer.phone}</div>
                )}
                {customer.address && (
                  <div className="text-sm font-normal text-gray-900 whitespace-pre-line">
                    {customer.address}
                  </div>
                )}
              </>
            ) : (
              <div className="text-gray-400">No customer selected</div>
            )}
          </div>

          <div className="space-y-3 text-right">
            <div className="space-y-1">
              <div className="text-xs uppercase text-gray-500">{docType} No.</div>
              <div className="text-sm font-normal text-gray-900">
                {docNumber || "AUTO"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase text-gray-500">Issue Date</div>
              <div className="text-sm font-normal text-gray-900">
                {issueDate ? new Date(issueDate).toLocaleDateString("en-GB") : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="mt-3">
        <div className="overflow-hidden min-h-[220px] flex flex-col">
          <div>
            <div className="grid grid-cols-12 text-xs font-semibold text-gray-700 px-0 py-2 border-y border-gray-300">
              <div className="col-span-6">Description</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Unit Price</div>
              <div className="col-span-2 text-right">Total Price</div>
            </div>
            <div className="min-h-[220px]">
              {items.length === 0 ? (
                <div className="py-3 text-gray-500 text-sm">No items</div>
              ) : (
                items.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 py-[0.1875rem] text-sm"
                  >
                    <div className="col-span-6 text-gray-900">
                      {item.description}
                    </div>
                    <div className="col-span-2 text-right text-gray-700">
                      {item.quantity}
                    </div>
                    <div className="col-span-2 text-right text-gray-700">
                      {formatCurrency(Number(item.unitPrice || 0), currency)}
                    </div>
                    <div className="col-span-2 text-right font-medium text-gray-900">
                      {formatCurrency(
                        Number(
                          item.amount ??
                            Number(item.quantity || 0) * Number(item.unitPrice || 0)
                        ),
                        currency
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          {/* Separator at bottom of items table container */}
          <div className="border-b border-gray-300 mt-auto"></div>
        </div>

        <div className="flex justify-end mt-1">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-normal">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-bold text-[13px] text-gray-900">Total</span>
              <span className="font-bold text-lg text-gray-900">
                {formatCurrency(total, currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="mt-4 space-y-4 text-xs text-gray-800">
        <div className="font-semibold">Terms:</div>
        <div className="text-gray-800 leading-[0.95]">
          <div>All goods sold are non-returnable and non-refundable.</div>
          <div>All payment be bank transfer should be made to the following bank details.</div>
          <div className="pl-6">PERABOT MEGAH ENTERPRISE</div>
          <div className="pl-6">Public Bank (A/C NO: 3242595608)</div>
        </div>

        <div className="pt-4 space-y-3">
          <div className="font-semibold">Issued by</div>
          <div className="w-20 h-20 flex items-center justify-center">
            <Image
              src="/company-chop.png"
              alt="Company Chop"
              width={80}
              height={80}
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

