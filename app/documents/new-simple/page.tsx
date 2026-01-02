"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Customer, LineItem, DocumentType } from "@/lib/types";
import { getCustomers, createCustomer, createDocument, getItemSuggestions, ItemSuggestion } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, Plus, X, Search } from "lucide-react";
import Link from "next/link";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { DocumentPDF } from "@/components/DocumentPDF";
import { pdf } from '@react-pdf/renderer';

// Dynamically import PDFViewer for client-side preview
const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFViewer),
  { ssr: false }
);

export default function NewDocumentSimplePage() {
  const router = useRouter();
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [itemSuggestions, setItemSuggestions] = React.useState<ItemSuggestion[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // Form State
  const [type, setType] = React.useState<DocumentType>("INVOICE");
  const [date, setDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);
  const [isTempCustomer, setIsTempCustomer] = React.useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = React.useState(false);
  const [customerSearch, setCustomerSearch] = React.useState("");
  const [isAddingCustomer, setIsAddingCustomer] = React.useState(false);
  const [newCustomer, setNewCustomer] = React.useState({ name: "", phone: "", address: "", email: "" });

  const [items, setItems] = React.useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0, amount: 0 }
  ]);
  const [deliveryFee, setDeliveryFee] = React.useState(0);
  const [isFreeDelivery, setIsFreeDelivery] = React.useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = React.useState(false);
  // Track which item has suggestions dropdown open (by index)
  const [openItemSuggestions, setOpenItemSuggestions] = React.useState<number | null>(null);

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

      // 3. Auto-detect if shipping is different from billing to toggle UI
      const hasUniqueShipping = (sName !== selectedCustomer.name) || (sAddr !== bAddr) || (sPhone !== bPhone);
      setIsDifferentShipping(hasUniqueShipping);
    }
  }, [selectedCustomer]);

  React.useEffect(() => {
    Promise.all([
      getCustomers().then(data => {
        setCustomers(data);
        setIsLoading(false);
      }),
      getItemSuggestions().then(data => {
        console.log("Received item suggestions in component:", data);
        console.log("Number of suggestions:", data.length);
        setItemSuggestions(data);
      }).catch(err => {
        console.error("Error fetching item suggestions in component:", err);
        setItemSuggestions([]);
      })
    ]);
  }, []);

  // Calculate preview scale to fit container width
  // Document number state - starts with preview, updates when saved
  const [docNumber, setDocNumber] = React.useState<string>('');

  // Calculate document number preview (simulated - actual will be generated on save)
  const docNumberPreview = React.useMemo(() => {
    if (docNumber) return docNumber; // Use saved doc number if available
    const now = new Date();
    const year = now.getFullYear().toString().substr(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}${month}-XXX`; // Will be replaced with actual number on save
  }, [date, docNumber]);

  // Document type labels (sentence case)
  const documentTypeLabels: Record<DocumentType, string> = {
    INVOICE: "Invoice",
    QUOTATION: "Quotation",
    RECEIPT: "Receipt",
    DELIVERY_ORDER: "Delivery Order",
  };

  // Base items (exclude empty descriptions)
  const baseItems = React.useMemo(
    () => items.filter(i => i.description.trim() !== ""),
    [items]
  );

  // Items to preview/save (includes delivery/free-delivery)
  const previewItems = React.useMemo(() => {
    const list = [...baseItems];
    if (isFreeDelivery) {
      list.push({
        description: "Free Delivery",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
      });
    } else if (!isFreeDelivery && deliveryFee !== 0) {
      list.push({
        description: "Delivery Fee",
        quantity: 1,
        unitPrice: deliveryFee,
        amount: deliveryFee,
      });
    }
    return list;
  }, [baseItems, isFreeDelivery, deliveryFee]);

  // Shared PDF document for preview/download
  const imageUrl = React.useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/company-chop.png` : '/company-chop.png'),
    []
  );

  // Helper for delivery order detection
  const isDocTypeDO = (type: string) =>
    type.toUpperCase().includes('DELIVERY') || type.toUpperCase().includes('D.O') || type.toUpperCase() === 'DO';

  const pdfDocument = React.useMemo(() => (
    <DocumentPDF
      docType={documentTypeLabels[type]}
      docNumber={docNumber || docNumberPreview}
      issueDate={date}
      customer={selectedCustomer ? {
        name: selectedCustomer.name,
        phone: billingPhone || selectedCustomer.phone || "",
        address: billingAddress || selectedCustomer.address || "",
        shippingName: isDifferentShipping ? shippingName : selectedCustomer.name,
        shippingAddress: isDifferentShipping ? shippingAddress : (billingAddress || selectedCustomer.address || ""),
        shippingPhone: isDifferentShipping ? shippingPhone : (billingPhone || selectedCustomer.phone || ""),
      } : null}
      items={previewItems}
      currency="MYR"
      imageUrl={imageUrl}
      isDeliveryOrder={type === 'DELIVERY_ORDER' || isDocTypeDO(type)}
    />
  ), [type, docNumber, docNumberPreview, date, selectedCustomer, previewItems, imageUrl, billingAddress, billingPhone, billingEmail, isDifferentShipping, shippingName, shippingAddress, shippingPhone]);

  const subtotal = baseItems.reduce(
    (sum, item) =>
      sum + Number(item.amount ?? Number(item.quantity || 0) * Number(item.unitPrice || 0)),
    0
  );
  const totalAmount = previewItems.reduce(
    (sum, item) =>
      sum + Number(item.amount ?? Number(item.quantity || 0) * Number(item.unitPrice || 0)),
    0
  );

  const handleAddCustomer = async () => {
    if (!newCustomer.name) return;
    // Do NOT persist yet. Mark as temporary until document is saved.
    const temp = {
      ...newCustomer,
      id: "TEMP-" + Date.now(),
      createdAt: new Date().toISOString(),
      billingAddress: newCustomer.address,
      billingPhone: newCustomer.phone,
      billingEmail: newCustomer.email,
      shippingName: newCustomer.name,
      shippingAddress: newCustomer.address,
      shippingPhone: newCustomer.phone
    };
    setSelectedCustomer(temp);
    setIsTempCustomer(true);
    setIsAddingCustomer(false);
    setNewCustomer({ name: "", phone: "", address: "", email: "" });
    setShowCustomerSearch(false);
  };

  // Generate document prefix for filename
  const getDocumentPrefix = (docType: DocumentType): string => {
    if (isDocTypeDO(docType)) {
      return 'DO';
    }
    return docType.charAt(0); // First letter: I, Q, R
  };

  // Download PDF using react-pdf for proper text extraction
  // This creates a text-based PDF with correct text order for copying
  const downloadPDF = async (docNumberToUse: string) => {
    try {
      // Create PDF document using react-pdf
      const imageUrl = `${window.location.origin}/company-chop.png`;
      const pdfDoc = (
        <DocumentPDF
          docType={documentTypeLabels[type]}
          docNumber={docNumberToUse}
          issueDate={date}
          customer={selectedCustomer ? {
            name: selectedCustomer.name,
            phone: billingPhone || selectedCustomer.phone || "",
            address: billingAddress || selectedCustomer.address || "",
            shippingName: isDifferentShipping ? shippingName : selectedCustomer.name,
            shippingAddress: isDifferentShipping ? shippingAddress : (billingAddress || selectedCustomer.address || ""),
            shippingPhone: isDifferentShipping ? shippingPhone : (billingPhone || selectedCustomer.phone || ""),
          } : null}
          items={previewItems}
          currency="MYR"
          imageUrl={imageUrl}
          isDeliveryOrder={type === 'DELIVERY_ORDER' || isDocTypeDO(type)}
        />
      );

      // Generate PDF blob
      const blob = await pdf(pdfDoc).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename with prefix
      const prefix = getDocumentPrefix(type);
      const filename = `${prefix}${docNumberToUse}.pdf`;
      link.download = filename;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    // Prevent saving the same document multiple times
    if (docNumber) {
      alert("This document has already been saved. To create another, start a new document.");
      return;
    }
    if (!selectedCustomer) {
      alert("Please select a customer");
      return;
    }

    if (items.length === 0 || items.every(i => !i.description.trim())) {
      alert("Please add at least one item");
      return;
    }

    setIsSaving(true);

    const allItems = [...previewItems];

    // If customer is temporary, create it first
    let customerId = selectedCustomer.id;
    let customerName = selectedCustomer.name;
    if (isTempCustomer) {
      const resCust = await createCustomer({
        name: selectedCustomer.name,
        phone: selectedCustomer.phone,
        address: selectedCustomer.address,
        email: selectedCustomer.email,
        billingAddress: billingAddress,
        billingPhone: billingPhone,
        billingEmail: billingEmail,
        shippingName: shippingName,
        shippingAddress: shippingAddress,
        shippingPhone: shippingPhone
      });
      if (!resCust.success) {
        setIsSaving(false);
        alert("Error saving customer: " + (resCust.error || "Unknown error"));
        return;
      }
      customerId = resCust.id;
      // Update state with real customer
      const added = { ...selectedCustomer, id: resCust.id };
      setSelectedCustomer(added);
      setCustomers(prev => [...prev, added]);
      setIsTempCustomer(false);
    }

    const payload = {
      type,
      date,
      customerId,
      customerName,
      totalAmount,
      status: type === 'INVOICE' ? 'PENDING' : 'DRAFT',
      notes: '',
      billingAddress,
      billingPhone,
      billingEmail,
      shippingName: isDifferentShipping ? shippingName : selectedCustomer.name,
      shippingAddress: isDifferentShipping ? shippingAddress : billingAddress,
      shippingPhone: isDifferentShipping ? shippingPhone : billingPhone,
      items: allItems.filter(i => i.description.trim() !== '')
    };

    const res = await createDocument(payload);

    if (res.success) {
      // Update document number state first so preview shows correct number
      setDocNumber(res.docNumber);

      // Wait for React to update the DOM with the new document number
      // Then download PDF (no navigation)
      setTimeout(async () => {
        try {
          await downloadPDF(res.docNumber);
          setIsSaving(false);
        } catch (error) {
          console.error('PDF download failed:', error);
          setIsSaving(false);
        }
      }, 400);
    } else {
      alert("Error saving: " + res.error);
      setIsSaving(false);
    }
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unitPrice: 0, amount: 0 }]);
  };

  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      item.amount = Number(item.quantity) * Number(item.unitPrice);
    }

    newItems[index] = item;
    setItems(newItems);
  };

  const updateItemMultiple = (index: number, updates: Partial<LineItem>) => {
    const newItems = [...items];
    const item = { ...newItems[index], ...updates };

    // Recalculate amount if quantity or unitPrice changed
    if ('quantity' in updates || 'unitPrice' in updates) {
      item.amount = Number(item.quantity) * Number(item.unitPrice);
    }

    newItems[index] = item;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Filter customers based on search - show all if no search, filtered if searching
  const filteredCustomers = React.useMemo(() => {
    if (!customerSearch.trim()) return customers; // Show all on focus
    return customers.filter(c => {
      const nameMatch = c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || false;
      const phoneMatch = c.phone ? String(c.phone).includes(customerSearch) : false;
      return nameMatch || phoneMatch;
    });
  }, [customers, customerSearch]);

  // Check if customer search doesn't match any existing customer
  const hasExactMatch = React.useMemo(() => {
    if (!customerSearch.trim()) return false;
    return customers.some(c =>
      c.name?.toLowerCase().trim() === customerSearch.toLowerCase().trim()
    );
  }, [customers, customerSearch]);

  // Handle switching to add customer form with prefilled name
  const switchToAddCustomer = () => {
    setIsAddingCustomer(true);
    setNewCustomer(prev => ({ ...prev, name: customerSearch.trim() }));
    setShowCustomerSearch(false);
  };

  // Handle Enter key or blur - switch to add customer if no match
  const handleCustomerInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && customerSearch.trim() && !hasExactMatch && filteredCustomers.length === 0) {
      e.preventDefault();
      switchToAddCustomer();
    }
  };

  const handleCustomerInputBlur = () => {
    // Small delay to allow dropdown click to register first
    setTimeout(() => {
      if (customerSearch.trim() && !hasExactMatch && filteredCustomers.length === 0 && !isAddingCustomer) {
        switchToAddCustomer();
      }
    }, 200);
  };

  // Filter item suggestions - exclude delivery items and filter by search
  // Show all items on focus, filter as user types (like customer dropdown)
  const getFilteredItemSuggestions = (currentValue: string): ItemSuggestion[] => {
    const deliveryKeywords = ['delivery', 'delivery fee', 'free delivery', 'shipping', 'shipping fee'];
    // First, exclude delivery-related items
    let filtered = itemSuggestions.filter(item => {
      const lower = item.description.toLowerCase();
      return !deliveryKeywords.some(keyword => lower.includes(keyword));
    });

    // If there's a search value, filter by it (show all if empty, like customer dropdown)
    if (currentValue.trim()) {
      filtered = filtered.filter(item => {
        const desc = item.description.toLowerCase();
        const search = currentValue.toLowerCase();
        return desc.includes(search) && desc !== search;
      });
    }

    return filtered.slice(0, 15); // Limit to 15 items
  };

  // Phone number formatting function
  const formatPhoneNumber = (input: string): string => {
    if (!input) return '';

    // Remove all non-digit characters
    let digits = input.replace(/\D/g, '');
    const originalLength = digits.length;
    const hadLeadingZero = digits.startsWith('0');

    // Remove country code if present (+60 or 60)
    // Malaysian numbers: 10-12 digits with country code, 8-10 digits without
    if (digits.startsWith('60') && digits.length >= 10) {
      digits = '0' + digits.substring(2);
    }

    // Must start with 0 for Malaysian numbers
    if (!digits.startsWith('0')) {
      // If valid length without 0, add it
      if (digits.length >= 8 && digits.length <= 10) {
        digits = '0' + digits;
      } else {
        return digits; // Return cleaned digits if doesn't match
      }
    }

    // Fixed line numbers with 3-digit area codes (088, 089): 8, 9, 10, or 11 digits total
    // Check for 3-digit area codes first, before 2-digit area codes
    if (digits.startsWith('088') || digits.startsWith('089')) {
      if (digits.length === 8 || digits.length === 9 || digits.length === 10 || digits.length === 11) {
        return `${digits.substring(0, 3)}-${digits.substring(3)}`;
      }
    }

    // Special case: 8-digit numbers that originally didn't have leading 0
    // When we add 0 to make it 9 digits starting with 01, treat as fixed line (01-xxxxxxx)
    if (originalLength === 8 && !hadLeadingZero && digits.length === 9 && digits.startsWith('01')) {
      return `${digits.substring(0, 2)}-${digits.substring(2)}`;
    }

    // Mobile numbers: 01x-xxxxxxx or 01x-xxxxxxxx (9, 10, or 11 digits total)
    // Check mobile numbers before other fixed line numbers
    // Note: 011 is a special case - it's a 3-digit area code, not mobile
    if (digits.startsWith('01') && !digits.startsWith('011') && !digits.startsWith('088') && !digits.startsWith('089')) {
      if (digits.length === 9) {
        return `${digits.substring(0, 3)}-${digits.substring(3)}`;
      }
      if (digits.length === 10) {
        return `${digits.substring(0, 3)}-${digits.substring(3)}`;
      }
      if (digits.length === 11) {
        return `${digits.substring(0, 3)}-${digits.substring(3)}`;
      }
    }

    // Fixed line numbers with 2-digit area codes (03, 04, 07, etc.): 8, 9, 10, or 11 digits total
    // 8-digit numbers are always treated as fixed line (even if they start with 01)
    if (digits.length === 8) {
      return `${digits.substring(0, 2)}-${digits.substring(2)}`;
    }

    // Fixed line numbers with 2-digit area codes: 9, 10, or 11 digits total
    // Exclude mobile numbers (01x with 9-11 digits) which are already handled above
    // Also exclude 3-digit area codes (088, 089, 011) which are already handled
    if (digits.length === 9 && !digits.startsWith('01')) {
      return `${digits.substring(0, 2)}-${digits.substring(2)}`;
    }
    if (digits.length === 10 && !digits.startsWith('01')) {
      return `${digits.substring(0, 2)}-${digits.substring(2)}`;
    }
    if (digits.length === 11 && !digits.startsWith('01')) {
      return `${digits.substring(0, 2)}-${digits.substring(2)}`;
    }

    // Handle 011 as 3-digit area code (special case)
    if (digits.startsWith('011') && (digits.length === 9 || digits.length === 10 || digits.length === 11)) {
      return `${digits.substring(0, 3)}-${digits.substring(3)}`;
    }

    // Partial input - return digits as user types
    return digits;
  };

  // Dynamic page title
  const pageTitle = React.useMemo(() => {
    const formattedType = type ? documentTypeLabels[type] : null;
    const customerName = selectedCustomer?.name;

    if (formattedType && customerName) {
      return `New ${formattedType} for ${customerName}`;
    } else if (formattedType) {
      return `New ${formattedType}`;
    } else if (customerName) {
      return `New Document for ${customerName}`;
    }
    return 'New Document';
  }, [selectedCustomer, type]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-gray-200 rounded-full">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
          </div>
          <Button onClick={handleSave} disabled={isSaving || !!docNumber}>
            <Download className="h-4 w-4 mr-2" />
            {docNumber ? "Saved" : isSaving ? "Saving..." : "Save and Download"}
          </Button>
        </div>

        {/* Form and Preview Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main Form */}
          <Card className="border-none shadow-lg no-print">
            <CardContent className="p-8 space-y-6">

              {/* Document Type Selection */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-500 block mb-2">Document type</label>
                <div className="flex gap-2 flex-wrap">
                  {(['INVOICE', 'QUOTATION', 'RECEIPT', 'DELIVERY_ORDER'] as DocumentType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${type === t
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {documentTypeLabels[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Document ID & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-500 block mb-2">
                    Document number
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-600">
                    {docNumberPreview}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Auto-generated on save</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-500 block mb-2">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Customer Selection */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-500 block mb-2">Customer</label>
                {selectedCustomer ? (
                  <div className="p-4 bg-gray-50 rounded-md border border-gray-200 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-lg">{selectedCustomer.name}</div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedCustomer(null);
                          setShowCustomerSearch(false);
                          setCustomerSearch("");
                          setIsDifferentShipping(false);
                        }}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <Input
                        placeholder="Billing Address"
                        value={billingAddress}
                        onChange={e => setBillingAddress(e.target.value)}
                        className="text-sm bg-white"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Phone"
                          value={billingPhone}
                          onChange={e => setBillingPhone(e.target.value)}
                          className="text-sm bg-white"
                        />
                        <Input
                          placeholder="Email"
                          value={billingEmail}
                          onChange={e => setBillingEmail(e.target.value)}
                          className="text-sm bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-dashed">
                      <input
                        type="checkbox"
                        id="diff-shipping-simple"
                        checked={isDifferentShipping}
                        onChange={e => setIsDifferentShipping(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="diff-shipping-simple" className="text-xs font-medium text-gray-700 cursor-pointer">
                        Different Shipping Address
                      </label>
                    </div>

                    {isDifferentShipping && (
                      <div className="space-y-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-1">
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
                  </div>
                ) : (
                  <div className="space-y-2">
                    {!isAddingCustomer ? (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
                          <Input
                            placeholder="Select or search customer..."
                            className="pl-10"
                            value={customerSearch}
                            onChange={(e) => {
                              setCustomerSearch(e.target.value);
                              setShowCustomerSearch(true);
                            }}
                            onFocus={() => setShowCustomerSearch(true)}
                            onKeyDown={handleCustomerInputKeyDown}
                            onBlur={handleCustomerInputBlur}
                          />
                          <Dropdown
                            isOpen={showCustomerSearch}
                            onClose={() => setShowCustomerSearch(false)}
                          >
                            {filteredCustomers.length === 0 && !customerSearch.trim() ? (
                              <div className="px-4 py-3 text-sm text-gray-500">
                                No customers available
                              </div>
                            ) : filteredCustomers.length === 0 && customerSearch.trim() ? (
                              <DropdownItem
                                onClick={() => {
                                  switchToAddCustomer();
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <Plus className="h-4 w-4 text-primary" />
                                  <div>
                                    <div className="font-medium text-gray-900">Add "{customerSearch}" as new customer</div>
                                    <div className="text-xs text-gray-500 mt-0.5">Press Enter or click to add</div>
                                  </div>
                                </div>
                              </DropdownItem>
                            ) : (
                              <>
                                {filteredCustomers.map(c => (
                                  <DropdownItem
                                    key={c.id}
                                    onClick={() => {
                                      setSelectedCustomer(c);
                                      setShowCustomerSearch(false);
                                      setCustomerSearch(c.name);
                                    }}
                                  >
                                    <div>
                                      <div className="font-medium text-gray-900">{c.name}</div>
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        {c.phone} {c.address && `• ${c.address}`}
                                      </div>
                                    </div>
                                  </DropdownItem>
                                ))}
                                {customerSearch.trim() && !hasExactMatch && (
                                  <DropdownItem
                                    onClick={() => {
                                      switchToAddCustomer();
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Plus className="h-4 w-4 text-primary" />
                                      <div>
                                        <div className="font-medium text-gray-900">Add "{customerSearch}" as new customer</div>
                                        <div className="text-xs text-gray-500 mt-0.5">Press Enter or click to add</div>
                                      </div>
                                    </div>
                                  </DropdownItem>
                                )}
                              </>
                            )}
                          </Dropdown>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => setIsAddingCustomer(true)}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" /> Add New Customer
                        </Button>
                      </>
                    ) : (
                      <div className="p-4 border rounded-md bg-gray-50 space-y-3">
                        <Input placeholder="Name *" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                        <Input
                          placeholder="Phone"
                          value={newCustomer.phone}
                          onChange={e => {
                            const formatted = formatPhoneNumber(e.target.value);
                            setNewCustomer({ ...newCustomer, phone: formatted });
                          }}
                        />
                        <Input placeholder="Email" value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                        <Input placeholder="Address" value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleAddCustomer} className="flex-1">
                            Use for this document
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setIsAddingCustomer(false)} className="flex-1">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div className="space-y-4">
                <label className="text-sm font-semibold text-gray-500 block mb-2">Items</label>
                {items.map((item, index) => {
                  const itemSuggestionsList = getFilteredItemSuggestions(item.description);
                  const showItemSuggestions = openItemSuggestions === index;

                  return (
                    <div key={index} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-6 relative">
                        <Input
                          value={item.description}
                          onChange={e => {
                            updateItem(index, 'description', e.target.value);
                            setOpenItemSuggestions(index);
                          }}
                          onFocus={() => setOpenItemSuggestions(index)}
                          placeholder="Item description"
                        />
                        {itemSuggestionsList.length > 0 && (
                          <Dropdown
                            isOpen={showItemSuggestions}
                            onClose={() => setOpenItemSuggestions(null)}
                          >
                            {itemSuggestionsList.map((suggestion, i) => (
                              <DropdownItem
                                key={i}
                                onClick={() => {
                                  // Update both description and price when item is selected
                                  updateItemMultiple(index, {
                                    description: suggestion.description,
                                    unitPrice: suggestion.price
                                  });
                                  setOpenItemSuggestions(null);
                                }}
                              >
                                {suggestion.description}
                              </DropdownItem>
                            ))}
                          </Dropdown>
                        )}
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity || ''}
                          onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          placeholder="Qty"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitPrice || ''}
                          onChange={e => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          placeholder="Unit Price"
                          className={item.unitPrice < 0 ? 'border-red-300' : ''}
                        />
                        {item.unitPrice < 0 && (
                          <p className="text-xs text-red-500 mt-1">Negative for discount</p>
                        )}
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <div className="flex-1 text-right font-medium text-sm">
                          RM {item.amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {items.length > 1 && (
                          <button
                            onClick={() => removeItem(index)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" onClick={addItem} className="w-full border-dashed">
                  <Plus className="h-4 w-4 mr-2" /> Add Item
                </Button>
              </div>

              {/* Delivery Fee Section */}
              <div className="border-t pt-4 space-y-3">
                <label className="text-sm font-semibold text-gray-500 block mb-2">Delivery</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={isFreeDelivery}
                      onChange={e => setIsFreeDelivery(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 focus:outline-none cursor-pointer transition-all duration-200 checked:bg-primary checked:border-primary hover:border-primary/80"
                      style={{
                        accentColor: 'hsl(var(--primary))'
                      }}
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">Free Delivery</span>
                  </label>
                  {!isFreeDelivery && (
                    <div className="flex-1 max-w-xs">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={deliveryFee || ''}
                        onChange={e => setDeliveryFee(parseFloat(e.target.value) || 0)}
                        placeholder="Delivery Fee"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-medium">RM {subtotal.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {!isFreeDelivery && deliveryFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Delivery Fee</span>
                        <span className="font-medium">RM {deliveryFee.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="font-bold text-gray-900">Total</span>
                      <span className="font-bold text-2xl text-primary">
                        RM {totalAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Preview Section (PDFViewer matches downloaded PDF) */}
          <div className="no-print">
            <Card className="border-none shadow-md sticky top-6">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Preview</h2>
                  <div className="text-sm text-gray-500">{docNumberPreview}</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <PDFViewer width="100%" height={900} showToolbar={true}>
                    {pdfDocument}
                  </PDFViewer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

