"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Customer, LineItem, DocumentType } from "@/lib/types";
import { getCustomers, createDocument } from "@/lib/api";
import { CustomerSelector } from "@/components/CustomerSelector";
import { LineItemsEditor } from "@/components/LineItemsEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Printer } from "lucide-react";
import Link from "next/link";

export default function NewDocumentPage() {
  const router = useRouter();
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // Form State
  const [type, setType] = React.useState<DocumentType>("INVOICE");
  const [date, setDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);
  const [items, setItems] = React.useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0, amount: 0 }
  ]);
  const [notes, setNotes] = React.useState("");

  // Granular Field States
  const [billingAddress, setBillingAddress] = React.useState("");
  const [billingPhone, setBillingPhone] = React.useState("");
  const [billingEmail, setBillingEmail] = React.useState("");

  const [isDifferentShipping, setIsDifferentShipping] = React.useState(false);
  const [shippingName, setShippingName] = React.useState("");
  const [shippingAddress, setShippingAddress] = React.useState("");
  const [shippingPhone, setShippingPhone] = React.useState("");

  // Sync logic: If not different, shipping = billing
  React.useEffect(() => {
    if (!isDifferentShipping && selectedCustomer) {
      setShippingName(selectedCustomer.shippingName || selectedCustomer.name);
      setShippingAddress(billingAddress);
      setShippingPhone(billingPhone);
    }
  }, [isDifferentShipping, billingAddress, billingPhone, selectedCustomer]);

  React.useEffect(() => {
    if (selectedCustomer) {
      // 1. Set Billing Defaults
      const bAddr = selectedCustomer.billingAddress || selectedCustomer.address || "";
      const bPhone = selectedCustomer.billingPhone || selectedCustomer.phone || "";
      const bEmail = selectedCustomer.billingEmail || selectedCustomer.email || "";

      setBillingAddress(bAddr);
      setBillingPhone(bPhone);
      setBillingEmail(bEmail);

      // 2. Set Shipping Defaults
      const sName = selectedCustomer.shippingName || selectedCustomer.name || "";
      const sAddr = selectedCustomer.shippingAddress || selectedCustomer.address || "";
      const sPhone = selectedCustomer.shippingPhone || selectedCustomer.phone || "";

      setShippingName(sName);
      setShippingAddress(sAddr);
      setShippingPhone(sPhone);

      // 3. Auto-detect if shipping is different from billing to toggle the UI
      const hasUniqueShipping = (sName !== selectedCustomer.name) || (sAddr !== bAddr) || (sPhone !== bPhone);
      setIsDifferentShipping(hasUniqueShipping);
    }
  }, [selectedCustomer]);

  React.useEffect(() => {
    getCustomers().then(data => {
      setCustomers(data);
      setIsLoading(false);
    });
  }, []);

  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  const handleSave = async () => {
    if (!selectedCustomer) {
      alert("Please select a customer");
      return;
    }

    setIsSaving(true);
    const payload = {
      type,
      date,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      totalAmount,
      status: type === 'INVOICE' ? 'PENDING' : 'DRAFT', // Default status
      notes,
      billingAddress,
      billingPhone,
      billingEmail,
      shippingName: isDifferentShipping ? shippingName : selectedCustomer.name,
      shippingAddress: isDifferentShipping ? shippingAddress : billingAddress,
      shippingPhone: isDifferentShipping ? shippingPhone : billingPhone,
      items
    };

    const res = await createDocument(payload);
    setIsSaving(false);

    if (res.success) {
      // Redirect to the view page for the new document
      // We need the docId from response, but for now we can just go to history or a success page
      // Ideally: router.push(`/documents/${res.docId}`);
      alert("Document Saved! ID: " + res.docNumber);
      router.push('/documents');
    } else {
      alert("Error saving: " + res.error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-gray-200 rounded-full">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">New Document</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()} className="hidden md:flex">
              <Printer className="h-4 w-4 mr-2" /> Print Preview
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Document"}
            </Button>
          </div>
        </div>

        {/* Main Form */}
        <Card className="border-none shadow-lg print:shadow-none">
          <CardContent className="p-8 space-y-8 print:p-0">

            {/* Document Header Info */}
            <div className="flex justify-between items-start border-b pb-8">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-blue-600 tracking-tight">
                  {type}
                </h2>
                <div className="flex gap-2 print:hidden">
                  {(['INVOICE', 'QUOTATION', 'RECEIPT'] as DocumentType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={`text-xs px-2 py-1 rounded ${type === t ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-right space-y-1">
                <div className="text-gray-500 text-sm">Date</div>
                <Input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-40 text-right print:border-none print:p-0 print:h-auto print:w-auto"
                />
                <div className="text-gray-500 text-sm mt-2">Document #</div>
                <div className="font-mono text-gray-400">AUTO-GENERATED</div>
              </div>
            </div>

            {/* Customer & Company Info */}
            <div className="grid grid-cols-2 gap-12">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  {type === 'DELIVERY_ORDER' ? 'Ship To' : 'Bill To'}
                </h3>
                {selectedCustomer ? (
                  <div className="space-y-4">
                    <div className="font-bold text-lg">
                      {type === 'DELIVERY_ORDER'
                        ? (isDifferentShipping ? shippingName : selectedCustomer.name)
                        : selectedCustomer.name
                      }
                    </div>

                    <div className="space-y-2">
                      <Input
                        placeholder="Address"
                        value={type === 'DELIVERY_ORDER'
                          ? (isDifferentShipping ? shippingAddress : billingAddress)
                          : billingAddress
                        }
                        onChange={e => {
                          const val = e.target.value;
                          if (type === 'DELIVERY_ORDER' && isDifferentShipping) {
                            setShippingAddress(val);
                          } else {
                            setBillingAddress(val);
                          }
                        }}
                        className="text-sm print:border-none print:p-0 print:h-auto"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Phone"
                          value={type === 'DELIVERY_ORDER'
                            ? (isDifferentShipping ? shippingPhone : billingPhone)
                            : billingPhone
                          }
                          onChange={e => {
                            const val = e.target.value;
                            if (type === 'DELIVERY_ORDER' && isDifferentShipping) {
                              setShippingPhone(val);
                            } else {
                              setBillingPhone(val);
                            }
                          }}
                          className="text-sm print:border-none print:p-0 print:h-auto"
                        />
                        <Input
                          placeholder="Email"
                          value={billingEmail}
                          onChange={e => setBillingEmail(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-dashed print:hidden">
                      <input
                        type="checkbox"
                        id="diff-shipping"
                        checked={isDifferentShipping}
                        onChange={e => setIsDifferentShipping(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="diff-shipping" className="text-xs font-medium text-gray-700 cursor-pointer">
                        Different Shipping Address
                      </label>
                    </div>

                    {isDifferentShipping && (
                      <div className="space-y-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100 mt-2 animate-in fade-in slide-in-from-top-1">
                        <h4 className="text-[10px] font-bold text-blue-500 uppercase">Shipping Details</h4>
                        <Input
                          placeholder="Shipping Name (e.g. Attn: John Doe)"
                          value={shippingName}
                          onChange={e => setShippingName(e.target.value)}
                          className="bg-white text-sm"
                        />
                        <Input
                          placeholder="Shipping Address"
                          value={shippingAddress}
                          onChange={e => setShippingAddress(e.target.value)}
                          className="bg-white text-sm"
                        />
                        <Input
                          placeholder="Shipping Phone"
                          value={shippingPhone}
                          onChange={e => setShippingPhone(e.target.value)}
                          className="bg-white text-sm"
                        />
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setIsDifferentShipping(false);
                      }}
                      className="text-xs text-red-500 hover:underline mt-2 print:hidden"
                    >
                      Change Customer
                    </button>
                  </div>
                ) : (
                  <div className="print:hidden">
                    <CustomerSelector
                      customers={customers}
                      onSelect={setSelectedCustomer}
                    />
                  </div>
                )}
              </div>

              <div className="text-right">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">From</h3>
                <div className="font-bold text-lg text-gray-900">Perabot Megah Enterprise</div>
                <div className="text-gray-600 text-sm">NO.12, TAMAN PERDANA</div>
                <div className="text-gray-600 text-sm">JALAN BAKRI, 84000 MUAR, JOHOR</div>
                <div className="text-gray-600 text-sm">perabotmegah@gmail.com</div>
              </div>
            </div>

            {/* Line Items */}
            <div className="pt-4">
              <LineItemsEditor items={items} onChange={setItems} />
            </div>

            {/* Footer Notes */}
            <div className="border-t pt-8 mt-8">
              <label className="text-sm font-semibold text-gray-500 uppercase mb-2 block">Notes / Terms</label>
              <textarea
                className="w-full h-24 p-2 border rounded-md resize-none focus:outline-none focus:ring-1 ring-blue-500 print:border-none print:p-0"
                placeholder="Enter payment terms, bank details, or thank you note..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}



