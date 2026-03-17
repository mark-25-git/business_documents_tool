"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Customer, LineItem, DocumentType, InvoiceDocument, CreateDocumentPayload } from "@/lib/types";
import { getCustomers, createCustomer, createDocument, getItemSuggestions, ItemSuggestion, getDocuments, getDocument, getNextDocNumber, updateDocument } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Download, Plus, X, Search } from "lucide-react";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { DocumentPDF } from "@/components/DocumentPDF";
import { pdf } from '@react-pdf/renderer';
import { Badge } from "@/components/ui/badge";

// Dynamically import PDFViewer for client-side preview
const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFViewer),
  { ssr: false }
);

function InvoiceEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlDocId = searchParams.get('doc');
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [itemSuggestions, setItemSuggestions] = React.useState<ItemSuggestion[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isFetchingDoc, setIsFetchingDoc] = React.useState(false);

  // Document Retrieval State
  const [allDocs, setAllDocs] = React.useState<InvoiceDocument[]>([]);
  const [docSearch, setDocSearch] = React.useState("");
  const [showDocSearch, setShowDocSearch] = React.useState(false);
  
  // Document Number State
  const [editableDocNumber, setEditableDocNumber] = React.useState<string>("");
  const [isDocNumberDuplicate, setIsDocNumberDuplicate] = React.useState(false);
  const [originalDocId, setOriginalDocId] = React.useState<string | null>(null);
  const [initialDocData, setInitialDocData] = React.useState<any>(null);

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

  const [syncToMaster, setSyncToMaster] = React.useState(false);

  // Tax State
  const [isTaxEnabled, setIsTaxEnabled] = React.useState(false);
  const [taxTitle, setTaxTitle] = React.useState("SST 10%");
  const [taxPercentage, setTaxPercentage] = React.useState(10);
  const [taxAmount, setTaxAmount] = React.useState(0);
  const [isTaxManuallyEdited, setIsTaxManuallyEdited] = React.useState(false);

  // Granular Field States
  const [billingName, setBillingName] = React.useState("");
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
      setShippingName(billingName || selectedCustomer.name);
      setShippingAddress(billingAddress);
      setShippingPhone(billingPhone);
    }
  }, [isDifferentShipping, billingName, billingAddress, billingPhone, selectedCustomer]);

  React.useEffect(() => {
    // Only load master defaults if:
    // 1. It's a new document (originalDocId is null)
    // 2. OR we are changing the customer in Edit Mode (ID differs from initial)
    const isInitialDocLoad = originalDocId && initialDocData && selectedCustomer?.id === initialDocData.customerId;

    if (selectedCustomer && !isInitialDocLoad) {
      // 1. Set Billing Defaults
      const bAddr = selectedCustomer.billingAddress || selectedCustomer.address || "";
      const bPhone = selectedCustomer.billingPhone || selectedCustomer.phone || "";
      const bEmail = selectedCustomer.billingEmail || selectedCustomer.email || "";

      setBillingName(selectedCustomer.name);
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
  }, [selectedCustomer, originalDocId, initialDocData]);

  React.useEffect(() => {
    Promise.all([
      getCustomers().then(data => {
        setCustomers(data);
      }),
      getDocuments().then(data => {
        setAllDocs(data);
      }),
      getNextDocNumber().then(num => {
        if (num) setEditableDocNumber(num);
      }),
      getItemSuggestions().then(data => {
        setItemSuggestions(data);
      }).catch(err => {
        console.error("Error fetching item suggestions:", err);
        setItemSuggestions([]);
      })
    ]).finally(() => {
      setIsLoading(false);
    });
  }, []);

  // Handle URL Parameter Sync
  React.useEffect(() => {
    if (urlDocId && urlDocId !== originalDocId) {
      handleSelectDocument(urlDocId);
    } else if (!urlDocId && originalDocId) {
      handleStartNew();
    }
  }, [urlDocId]);

  const filteredDocs = React.useMemo(() => {
    if (!docSearch.trim()) return allDocs;
    return allDocs.filter(d =>
      d.docNumber.toLowerCase().includes(docSearch.toLowerCase()) ||
      d.customerName.toLowerCase().includes(docSearch.toLowerCase())
    );
  }, [allDocs, docSearch]);

  const handleSelectDocument = async (docId: string) => {
    setIsFetchingDoc(true);
    setShowDocSearch(false);
    
    // Sync URL if not already there
    if (urlDocId !== docId) {
      router.push(`/?doc=${docId}`);
    }

    try {
      const fullDoc = await getDocument(docId);
      if (fullDoc) {
        const docItems = fullDoc.items || [];
        const taxIdx = docItems.findIndex(i => i.description.startsWith('TAX:'));
        const itemsWithoutTax = docItems.filter(i => !i.description.startsWith('TAX:'));
        const deliveryIdx = itemsWithoutTax.findIndex(i =>
          i.description.toLowerCase().includes('delivery') ||
          i.description.toLowerCase().includes('shipping fee')
        );
        const baseItemsList = itemsWithoutTax.filter((_, idx) => idx !== deliveryIdx);
        const finalItems: LineItem[] = baseItemsList.length > 0 ? baseItemsList : [{ description: "", quantity: 1, unitPrice: 0, amount: 0 }];
        
        const hasUniqueShipping =
          (fullDoc.shippingName && fullDoc.shippingName !== fullDoc.customerName) ||
          (fullDoc.shippingAddress && fullDoc.shippingAddress !== fullDoc.billingAddress) ||
          (fullDoc.shippingPhone && fullDoc.shippingPhone !== fullDoc.billingPhone);

        setOriginalDocId(fullDoc.id);
        setInitialDocData({
          date: fullDoc.date.split('T')[0],
          docNumber: fullDoc.docNumber,
          customerId: fullDoc.customerId,
          billingName: fullDoc.customerName || "",
          billingAddress: fullDoc.billingAddress || "",
          billingPhone: fullDoc.billingPhone || "",
          billingEmail: fullDoc.billingEmail || "",
          shippingName: fullDoc.shippingName || "",
          shippingAddress: fullDoc.shippingAddress || "",
          shippingPhone: fullDoc.shippingPhone || "",
          isDifferentShipping: !!hasUniqueShipping,
          items: finalItems.map(i => ({ ...i })),
          isTaxEnabled: taxIdx !== -1,
          taxTitle: taxIdx !== -1 ? docItems[taxIdx].description.replace('TAX:', '') : "SST 10%",
          taxAmount: taxIdx !== -1 ? docItems[taxIdx].amount : 0,
          deliveryFee: deliveryIdx !== -1 ? itemsWithoutTax[deliveryIdx].amount : 0,
          isFreeDelivery: deliveryIdx !== -1 && itemsWithoutTax[deliveryIdx].description.toLowerCase().includes('free')
        });

        setType(fullDoc.type);
        setDate(fullDoc.date.split('T')[0]);
        setEditableDocNumber(fullDoc.docNumber);

        const cust = customers.find(c => c.id === fullDoc.customerId);
        if (cust) {
          setSelectedCustomer(cust);
        } else {
          setSelectedCustomer({
            id: fullDoc.customerId,
            name: fullDoc.customerName,
            phone: fullDoc.billingPhone || "",
            address: fullDoc.billingAddress || "",
            email: fullDoc.billingEmail || ""
          });
        }

        setBillingName(fullDoc.customerName || "");
        setBillingAddress(fullDoc.billingAddress || "");
        setBillingPhone(fullDoc.billingPhone || "");
        setBillingEmail(fullDoc.billingEmail || "");

        setShippingName(fullDoc.shippingName || "");
        setShippingAddress(fullDoc.shippingAddress || "");
        setShippingPhone(fullDoc.shippingPhone || "");
        setIsDifferentShipping(!!hasUniqueShipping);

        setItems(finalItems);
        
        if (taxIdx !== -1) {
          setIsTaxEnabled(true);
          setTaxTitle(docItems[taxIdx].description.replace('TAX:', ''));
          setTaxAmount(docItems[taxIdx].amount);
          setIsTaxManuallyEdited(true);
        } else {
          setIsTaxEnabled(false);
        }

        if (deliveryIdx !== -1) {
          const delItem = itemsWithoutTax[deliveryIdx];
          if (delItem.description.toLowerCase().includes('free')) {
            setIsFreeDelivery(true);
            setDeliveryFee(0);
          } else {
            setIsFreeDelivery(false);
            setDeliveryFee(delItem.amount);
          }
        } else {
          setIsFreeDelivery(false);
          setDeliveryFee(0);
        }
      }
    } catch (err) {
      console.error("Failed to retrieve document:", err);
      alert("Failed to retrieve document details.");
    } finally {
      setIsFetchingDoc(false);
    }
  };

  const [docNumber, setDocNumber] = React.useState<string>('');

  const docNumberPreview = React.useMemo(() => {
    if (docNumber) return docNumber;
    if (editableDocNumber) return editableDocNumber;
    const now = new Date();
    const year = now.getFullYear().toString().substr(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}${month}-XXX`;
  }, [date, docNumber, editableDocNumber]);

  React.useEffect(() => {
    if (editableDocNumber.trim() && allDocs.length > 0) {
      const isDup = allDocs.some(d => 
        d.docNumber.toLowerCase() === editableDocNumber.toLowerCase() && 
        d.id !== originalDocId
      );
      setIsDocNumberDuplicate(isDup);
    } else {
      setIsDocNumberDuplicate(false);
    }
  }, [editableDocNumber, allDocs, originalDocId]);

  const isDirty = React.useMemo(() => {
    if (!originalDocId || !initialDocData) return true;
    if (date !== initialDocData.date) return true;
    if (editableDocNumber !== initialDocData.docNumber) return true;
    if (selectedCustomer?.id !== initialDocData.customerId) return true;
    if (billingName !== initialDocData.billingName) return true;
    if (billingAddress !== initialDocData.billingAddress) return true;
    if (billingPhone !== initialDocData.billingPhone) return true;
    if (billingEmail !== initialDocData.billingEmail) return true;
    if (isDifferentShipping !== initialDocData.isDifferentShipping) return true;
    if (isDifferentShipping) {
      if (shippingName !== initialDocData.shippingName) return true;
      if (shippingAddress !== initialDocData.shippingAddress) return true;
      if (shippingPhone !== initialDocData.shippingPhone) return true;
    }
    if (isTaxEnabled !== initialDocData.isTaxEnabled) return true;
    if (isTaxEnabled) {
      if (taxTitle !== initialDocData.taxTitle) return true;
      if (taxAmount !== initialDocData.taxAmount) return true;
    }
    if (isFreeDelivery !== initialDocData.isFreeDelivery) return true;
    if (!isFreeDelivery && deliveryFee !== initialDocData.deliveryFee) return true;
    if (syncToMaster) return true;

    const currentItems = items.filter(i => i.description.trim() !== "");
    const initialItemsList = initialDocData.items || [];
    if (currentItems.length !== initialItemsList.length) return true;
    for (let i = 0; i < currentItems.length; i++) {
      if (currentItems[i].description !== initialItemsList[i].description) return true;
      if (currentItems[i].quantity !== initialItemsList[i].quantity) return true;
      if (currentItems[i].unitPrice !== initialItemsList[i].unitPrice) return true;
    }
    return false;
  }, [originalDocId, initialDocData, date, editableDocNumber, selectedCustomer, billingName, billingAddress, billingPhone, billingEmail, isDifferentShipping, shippingName, shippingAddress, shippingPhone, isTaxEnabled, taxTitle, taxAmount, isFreeDelivery, deliveryFee, items, syncToMaster]);

  const documentTypeLabels: Record<DocumentType, string> = {
    INVOICE: "Invoice",
    QUOTATION: "Quotation",
    RECEIPT: "Receipt",
    DELIVERY_ORDER: "Delivery Order",
  };

  const baseItems = React.useMemo(() => items.filter(i => i.description.trim() !== ""), [items]);

  const previewItems = React.useMemo(() => {
    const list = [...baseItems];
    if (isFreeDelivery) {
      list.push({ description: "Free Delivery", quantity: 1, unitPrice: 0, amount: 0 });
    } else if (!isFreeDelivery && deliveryFee !== 0) {
      list.push({ description: "Delivery Fee", quantity: 1, unitPrice: deliveryFee, amount: deliveryFee });
    }
    return list;
  }, [baseItems, isFreeDelivery, deliveryFee]);

  const imageUrl = React.useMemo(() => (typeof window !== 'undefined' ? `${window.location.origin}/company-chop.png` : '/company-chop.png'), []);

  const isDocTypeDO = (type: string) => type.toUpperCase().includes('DELIVERY') || type.toUpperCase().includes('D.O') || type.toUpperCase() === 'DO';

  const pdfDocument = React.useMemo(() => (
    <DocumentPDF
      docType={documentTypeLabels[type]}
      docNumber={docNumber || docNumberPreview}
      issueDate={date}
      customer={selectedCustomer ? {
        name: billingName || selectedCustomer.name,
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
      taxTitle={isTaxEnabled ? taxTitle : undefined}
      taxAmount={isTaxEnabled ? taxAmount : undefined}
    />
  ), [type, docNumber, docNumberPreview, date, selectedCustomer, billingName, billingPhone, billingAddress, isDifferentShipping, shippingName, shippingAddress, shippingPhone, previewItems, imageUrl, isTaxEnabled, taxTitle, taxAmount]);

  const subtotal = baseItems.reduce((sum, item) => sum + Number(item.amount ?? Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);

  const totalAmount = React.useMemo(() => {
    let base = previewItems.reduce((sum, item) => sum + Number(item.amount ?? Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
    return base + (isTaxEnabled ? Number(taxAmount) : 0);
  }, [previewItems, isTaxEnabled, taxAmount]);

  React.useEffect(() => {
    if (isTaxEnabled && !isTaxManuallyEdited) {
      const currentSubtotal = baseItems.reduce((sum, item) => sum + Number(item.amount ?? Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
      const calculatedTax = currentSubtotal * (taxPercentage / 100);
      setTaxAmount(parseFloat(calculatedTax.toFixed(2)));
    }
  }, [baseItems, taxPercentage, isTaxEnabled, isTaxManuallyEdited]);

  const handleAddCustomer = async () => {
    if (!newCustomer.name) return;
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

  const getDocumentPrefix = (docType: DocumentType): string => {
    if (isDocTypeDO(docType)) return 'DO';
    return docType.charAt(0);
  };

  const downloadPDF = async (docNumberToUse: string) => {
    try {
      const blob = await pdf(pdfDocument).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${getDocumentPrefix(type)}${docNumberToUse}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  };

  const getPayload = async (): Promise<{ success: boolean; data?: CreateDocumentPayload; error?: string }> => {
    if (!selectedCustomer) return { success: false, error: "No customer selected" };
    const allItems = [...previewItems];
    if (isTaxEnabled) {
      allItems.push({ description: `TAX:${taxTitle}`, quantity: 1, unitPrice: taxAmount, amount: taxAmount });
    }
    return {
      success: true,
      data: {
        type: type,
        date: date,
        customerId: selectedCustomer.id,
        customerName: billingName,
        totalAmount: totalAmount,
        status: type === 'INVOICE' ? 'PENDING' : 'DRAFT',
        notes: '',
        billingAddress: billingAddress,
        billingPhone: billingPhone,
        billingEmail: billingEmail,
        shippingName: isDifferentShipping ? shippingName : selectedCustomer.name,
        shippingAddress: isDifferentShipping ? shippingAddress : (billingAddress || selectedCustomer.address || ""),
        shippingPhone: isDifferentShipping ? shippingPhone : (billingPhone || selectedCustomer.phone || ""),
        items: allItems.filter(i => i.description.trim() !== ''),
        docNumber: editableDocNumber.trim() || undefined,
        syncToMaster: syncToMaster
      }
    };
  };

  const handleSave = async () => {
    if (!selectedCustomer) { alert("Please select a customer"); return; }
    if (isDocNumberDuplicate) { alert("Document number already exists."); return; }
    const validItems = items.filter(i => i.description.trim() !== "");
    if (validItems.length === 0) { alert("Please add at least one item"); return; }
    setIsSaving(true);

    if (isTempCustomer) {
      const resCust = await createCustomer({
        name: selectedCustomer.name, phone: selectedCustomer.phone, address: selectedCustomer.address, email: selectedCustomer.email,
        billingAddress: billingAddress, billingPhone: billingPhone, billingEmail: billingEmail,
        shippingName: shippingName, shippingAddress: shippingAddress, shippingPhone: shippingPhone
      });
      if (!resCust.success) {
        setIsSaving(false);
        alert("Error saving customer: " + (resCust.error || "Unknown error"));
        return;
      }
      const added = { ...selectedCustomer, id: resCust.id };
      setSelectedCustomer(added);
      setCustomers(prev => [...prev, added]);
      setIsTempCustomer(false);
      const payloadResult = await getPayload();
      if (payloadResult.success) await performSave(payloadResult.data!);
    } else {
      const payloadResult = await getPayload();
      if (payloadResult.success) await performSave(payloadResult.data!);
      else { alert(payloadResult.error); setIsSaving(false); }
    }
  };

  const performSave = async (payload: CreateDocumentPayload) => {
    const res = originalDocId ? await updateDocument(originalDocId, payload) : await createDocument(payload);
    if (res.success) {
      setDocNumber(res.docNumber || "");
      setSyncToMaster(false);
      setInitialDocData({ ...payload, items: items.filter(i => i.description.trim() !== "").map(i => ({ ...i })), isTaxEnabled, taxTitle, taxAmount, deliveryFee, isFreeDelivery });
      if (!originalDocId && res.id) {
        setOriginalDocId(res.id);
        router.push(`/?doc=${res.id}`);
      }
      getDocuments().then(setAllDocs);
      alert(originalDocId ? "Changes updated successfully." : "Document saved successfully.");
    } else {
      alert("Error saving: " + res.error);
    }
    setIsSaving(false);
  };

  const handleDownload = async () => {
    setIsSaving(true);
    try { await downloadPDF(docNumber || editableDocNumber); }
    catch (error) { alert("Failed to download PDF."); }
    finally { setIsSaving(false); }
  };

  const handleStartNew = async () => {
    if (urlDocId) router.push('/');
    setOriginalDocId(null);
    setInitialDocData(null);
    setDocNumber("");
    setEditableDocNumber("");
    setIsDocNumberDuplicate(false);
    setType("INVOICE");
    setDate(new Date().toISOString().split('T')[0]);
    setSelectedCustomer(null);
    setItems([{ description: "", quantity: 1, unitPrice: 0, amount: 0 }]);
    setDeliveryFee(0);
    setIsFreeDelivery(false);
    setIsTaxEnabled(false);
    setSyncToMaster(false);
    setBillingName("");
    setBillingAddress("");
    setBillingPhone("");
    setBillingEmail("");
    setIsDifferentShipping(false);
    setShippingName("");
    setShippingAddress("");
    setShippingPhone("");

    const num = await getNextDocNumber();
    if (num) setEditableDocNumber(num);
  };

  const addItem = () => setItems([...items, { description: "", quantity: 1, unitPrice: 0, amount: 0 }]);
  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') item.amount = Number(item.quantity) * Number(item.unitPrice);
    newItems[index] = item;
    setItems(newItems);
  };
  const updateItemMultiple = (index: number, updates: Partial<LineItem>) => {
    const newItems = [...items];
    const item = { ...newItems[index], ...updates };
    if ('quantity' in updates || 'unitPrice' in updates) item.amount = Number(item.quantity) * Number(item.unitPrice);
    newItems[index] = item;
    setItems(newItems);
  };
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const filteredCustomers = React.useMemo(() => {
    if (!customerSearch.trim()) return customers;
    return customers.filter(c => c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || String(c.phone).includes(customerSearch));
  }, [customers, customerSearch]);

  const hasExactMatch = React.useMemo(() => {
    if (!customerSearch.trim()) return false;
    return customers.some(c => c.name?.toLowerCase().trim() === customerSearch.toLowerCase().trim());
  }, [customers, customerSearch]);

  const switchToAddCustomer = () => {
    setIsAddingCustomer(true);
    setNewCustomer(prev => ({ ...prev, name: customerSearch.trim() }));
    setShowCustomerSearch(false);
  };

  const handleCustomerInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && customerSearch.trim() && !hasExactMatch && filteredCustomers.length === 0) { e.preventDefault(); switchToAddCustomer(); }
  };

  const handleCustomerInputBlur = () => {
    setTimeout(() => { if (customerSearch.trim() && !hasExactMatch && filteredCustomers.length === 0 && !isAddingCustomer) switchToAddCustomer(); }, 200);
  };

  const getFilteredItemSuggestions = (currentValue: string): ItemSuggestion[] => {
    const deliveryKeywords = ['delivery', 'delivery fee', 'free delivery', 'shipping', 'shipping fee'];
    let filtered = itemSuggestions.filter(item => !deliveryKeywords.some(keyword => item.description.toLowerCase().includes(keyword)));
    if (currentValue.trim()) filtered = filtered.filter(item => item.description.toLowerCase().includes(currentValue.toLowerCase()) && item.description.toLowerCase() !== currentValue.toLowerCase());
    return filtered.slice(0, 15);
  };

  const formatPhoneNumber = (input: string): string => {
    if (!input) return '';
    let digits = input.replace(/\D/g, '');
    const originalLength = digits.length;
    const hadLeadingZero = digits.startsWith('0');
    if (digits.startsWith('60') && digits.length >= 10) digits = '0' + digits.substring(2);
    if (!digits.startsWith('0')) { if (digits.length >= 8 && digits.length <= 10) digits = '0' + digits; else return digits; }
    if ((digits.startsWith('088') || digits.startsWith('089')) && (digits.length >= 8 && digits.length <= 11)) return `${digits.substring(0, 3)}-${digits.substring(3)}`;
    if (originalLength === 8 && !hadLeadingZero && digits.length === 9 && digits.startsWith('01')) return `${digits.substring(0, 2)}-${digits.substring(2)}`;
    if (digits.startsWith('01') && !digits.startsWith('011') && !digits.startsWith('088') && !digits.startsWith('089') && (digits.length >= 9 && digits.length <= 11)) return `${digits.substring(0, 3)}-${digits.substring(3)}`;
    if (digits.length === 8) return `${digits.substring(0, 2)}-${digits.substring(2)}`;
    if (!digits.startsWith('01') && (digits.length >= 9 && digits.length <= 11)) return `${digits.substring(0, 2)}-${digits.substring(2)}`;
    if (digits.startsWith('011') && (digits.length >= 9 && digits.length <= 11)) return `${digits.substring(0, 3)}-${digits.substring(3)}`;
    return digits;
  };

  const pageTitle = React.useMemo(() => {
    const formattedType = type ? documentTypeLabels[type] : null;
    const customerName = selectedCustomer?.name;
    const prefix = originalDocId ? "" : "New ";
    if (formattedType && customerName) return `${prefix}${formattedType} for ${customerName}`;
    if (formattedType) return `${prefix}${formattedType}`;
    return `${prefix}Document`;
  }, [selectedCustomer, type, originalDocId]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Simple Header */}
        <div className="no-print">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{pageTitle}</h1>
        </div>

        {/* Toolbar Card */}
        <Card className="border-none shadow-sm overflow-visible no-print">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Left Section: Search & Start New (Half Width) */}
              <div className="flex items-center gap-3 w-full md:w-1/2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
                  <Input 
                    placeholder="Search documents..." 
                    className="pl-10 h-10 bg-white border-gray-200 focus:bg-white transition-all w-full" 
                    value={docSearch} 
                    onChange={(e) => { setDocSearch(e.target.value); setShowDocSearch(true); }} 
                    onFocus={() => setShowDocSearch(true)} 
                  />
                  <Dropdown isOpen={showDocSearch} onClose={() => setShowDocSearch(false)}>
                    {isLoading ? (
                      <div className="px-4 py-3 text-sm text-gray-500">Loading documents...</div>
                    ) : filteredDocs.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">No documents found</div>
                    ) : (
                      filteredDocs.map(d => (
                        <DropdownItem key={d.id} onClick={() => handleSelectDocument(d.id)}>
                          <div className="flex justify-between items-center w-full group">
                            <div>
                              <div className="font-medium text-gray-900 group-hover:text-primary transition-colors">{d.docNumber}</div>
                              <div className="text-[10px] text-gray-500">{d.customerName} • {new Date(d.date).toLocaleDateString('en-GB')}</div>
                            </div>
                            <div className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                              RM {d.totalAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        </DropdownItem>
                      ))
                    )}
                  </Dropdown>
                  {isFetchingDoc && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                  )}
                </div>
                <Button variant="outline" onClick={handleStartNew} className="h-10 px-4">
                  <Plus className="h-4 w-4 mr-2" />Start new
                </Button>
              </div>

              {/* Right Section: Action Buttons */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <Button variant="outline" onClick={handleDownload} disabled={isSaving || isDocNumberDuplicate} className="flex-1 md:flex-none h-10 px-4">
                  <Download className="h-4 w-4 mr-2" />Download PDF
                </Button>
                <Button onClick={handleSave} disabled={isSaving || isDocNumberDuplicate || (originalDocId ? !isDirty : false)} className="flex-1 md:flex-none h-10 px-4 shadow-sm">
                  {isSaving ? "Saving..." : originalDocId ? "Update changes" : "Save document"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-none shadow-lg no-print">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-500 block mb-2">Document type</label>
                <div className="flex gap-2 flex-wrap">{(['INVOICE', 'QUOTATION', 'RECEIPT', 'DELIVERY_ORDER'] as DocumentType[]).map(t => (
                  <button key={t} onClick={() => setType(t)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${type === t ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{documentTypeLabels[t]}</button>
                ))}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-500 block mb-2">Document number</label>
                  <Input value={editableDocNumber} onChange={e => setEditableDocNumber(e.target.value)} placeholder="e.g. 2403-001" className={`bg-white ${isDocNumberDuplicate ? 'border-red-500 focus-visible:ring-red-500' : ''}`} disabled={!!originalDocId || !!docNumber} />
                  {isDocNumberDuplicate && <p className="text-[10px] text-red-500 mt-1 font-medium">Duplicate document number</p>}
                  <p className="text-[10px] text-gray-400 mt-1">Leave empty to auto-generate</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-500 block mb-2">Date</label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-500 block mb-2">Customer</label>
                {selectedCustomer ? (
                  <div className="p-4 bg-gray-50 rounded-md border border-gray-200 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 space-y-2">
                        <label className="text-[10px] font-bold text-gray-400">Billing name</label>
                        <Input placeholder="Customer billing name" value={billingName} onChange={e => setBillingName(e.target.value)} className="text-lg font-bold bg-white h-11" />
                      </div>
                      <button onClick={() => { setSelectedCustomer(null); setShowCustomerSearch(false); setCustomerSearch(""); setIsDifferentShipping(false); }} className="text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="space-y-2">
                      <Input placeholder="Billing Address" value={billingAddress} onChange={e => setBillingAddress(e.target.value)} className="text-sm bg-white" />
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Phone" value={billingPhone} onChange={e => setBillingPhone(e.target.value)} className="text-sm bg-white" />
                        <Input placeholder="Email" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} className="text-sm bg-white" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-dashed">
                      <input type="checkbox" id="diff-shipping-simple" checked={isDifferentShipping} onChange={e => setIsDifferentShipping(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <label htmlFor="diff-shipping-simple" className="text-xs font-medium text-gray-700 cursor-pointer">Different Shipping Address</label>
                    </div>
                    {!isTempCustomer && (
                      <div className="flex items-center gap-2 pt-1">
                        <input type="checkbox" id="sync-to-master" checked={syncToMaster} onChange={e => setSyncToMaster(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <label htmlFor="sync-to-master" className="text-xs font-medium text-amber-600 cursor-pointer flex items-center gap-1">Update master record with these details</label>
                      </div>
                    )}
                    {isDifferentShipping && (
                      <div className="space-y-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-1">
                        <h4 className="text-[10px] font-bold text-blue-500">Shipping details</h4>
                        <Input placeholder="Shipping name" value={shippingName} onChange={e => setShippingName(e.target.value)} className="bg-white text-sm" />
                        <Input placeholder="Shipping address" value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className="bg-white text-sm" />
                        <Input placeholder="Shipping phone" value={shippingPhone} onChange={e => setShippingPhone(e.target.value)} className="bg-white text-sm" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {!isAddingCustomer ? (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
                          <Input placeholder="Select or search customer..." className="pl-10" value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerSearch(true); }} onFocus={() => setShowCustomerSearch(true)} onKeyDown={handleCustomerInputKeyDown} onBlur={handleCustomerInputBlur} />
                          <Dropdown isOpen={showCustomerSearch} onClose={() => setShowCustomerSearch(false)}>
                            {filteredCustomers.length === 0 && !customerSearch.trim() ? <div className="px-4 py-3 text-sm text-gray-500">No customers available</div> : filteredCustomers.length === 0 && customerSearch.trim() ? <DropdownItem onClick={switchToAddCustomer}><div className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /><div><div className="font-medium text-gray-900">Add \"{customerSearch}\" as new customer</div><div className="text-xs text-gray-500 mt-0.5">Press Enter or click to add</div></div></div></DropdownItem> : (
                              <>{filteredCustomers.map(c => (<DropdownItem key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerSearch(false); setCustomerSearch(c.name); }}><div><div className="font-medium text-gray-900">{c.name}</div><div className="text-xs text-gray-500 mt-0.5">{c.phone} {c.address && `• ${c.address}`}</div></div></DropdownItem>))}{customerSearch.trim() && !hasExactMatch && (<DropdownItem onClick={switchToAddCustomer}><div className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /><div><div className="font-medium text-gray-900">Add \"{customerSearch}\" as new customer</div><div className="text-xs text-gray-500 mt-0.5">Press Enter or click to add</div></div></div></DropdownItem>)}</>
                            )}
                          </Dropdown>
                        </div>
                        <Button variant="outline" onClick={() => setIsAddingCustomer(true)} className="w-full"><Plus className="h-4 w-4 mr-2" />Add new customer</Button>
                      </>
                    ) : (
                      <div className="p-4 border rounded-md bg-gray-50 space-y-3">
                        <Input placeholder="Name *" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                        <Input placeholder="Phone" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: formatPhoneNumber(e.target.value) })} />
                        <Input placeholder="Email" value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                        <Input placeholder="Address" value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} />
                        <div className="flex gap-2"><Button size="sm" onClick={handleAddCustomer} className="flex-1">Use for this document</Button><Button size="sm" variant="outline" onClick={() => setIsAddingCustomer(false)} className="flex-1">Cancel</Button></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <label className="text-sm font-semibold text-gray-500 block mb-2">Items</label>
                {items.map((item, index) => {
                  const itemSuggestionsList = getFilteredItemSuggestions(item.description);
                  const showItemSuggestions = openItemSuggestions === index;
                  return (
                    <div key={index} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-6 relative">
                        <Textarea value={item.description} onChange={e => { updateItem(index, 'description', e.target.value); setOpenItemSuggestions(index); }} onFocus={() => setOpenItemSuggestions(index)} placeholder="Item description" className="min-h-[40px] py-1 resize-y" />
                        {itemSuggestionsList.length > 0 && (<Dropdown isOpen={showItemSuggestions} onClose={() => setOpenItemSuggestions(null)}>{itemSuggestionsList.map((suggestion, i) => (<DropdownItem key={i} onClick={() => { updateItemMultiple(index, { description: suggestion.description, unitPrice: suggestion.price }); setOpenItemSuggestions(null); }}>{suggestion.description}</DropdownItem>))}</Dropdown>)}
                      </div>
                      <div className="col-span-2"><Input type="number" min="1" value={item.quantity || ''} onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)} placeholder="Qty" /></div>
                      <div className="col-span-2"><Input type="number" step="0.01" value={item.unitPrice || ''} onChange={e => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)} placeholder="Unit Price" className={item.unitPrice < 0 ? 'border-red-300' : ''} />{item.unitPrice < 0 && <p className="text-xs text-red-500 mt-1">Negative for discount</p>}</div>
                      <div className="col-span-2 flex items-center gap-2"><div className="flex-1 text-right font-medium text-sm">RM {item.amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>{items.length > 1 && (<button onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button>)}</div>
                    </div>
                  );
                })}
                <Button variant="outline" onClick={addItem} className="w-full border-dashed"><Plus className="h-4 w-4 mr-2" />Add Item</Button>
              </div>
              <div className="border-t pt-4 space-y-3">
                <label className="text-sm font-semibold text-gray-500 block mb-2">Delivery</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" checked={isFreeDelivery} onChange={e => setIsFreeDelivery(e.target.checked)} className="w-4 h-4 rounded border-gray-300 focus:outline-none cursor-pointer" style={{ accentColor: 'hsl(var(--primary))' }} /><span className="text-sm text-gray-700 group-hover:text-gray-900">Free Delivery</span></label>
                  {!isFreeDelivery && <div className="flex-1 max-w-xs"><Input type="number" step="0.01" min="0" value={deliveryFee || ''} onChange={e => setDeliveryFee(parseFloat(e.target.value) || 0)} placeholder="Delivery Fee" /></div>}
                </div>
              </div>
              <div className="border-t pt-4 space-y-3">
                <label className="text-sm font-semibold text-gray-500 block mb-2">Tax</label>
                <div className="space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer group w-fit"><input type="checkbox" checked={isTaxEnabled} onChange={e => { setIsTaxEnabled(e.target.checked); if (!e.target.checked) setIsTaxManuallyEdited(false); }} className="w-4 h-4 rounded border-gray-300 focus:outline-none cursor-pointer" style={{ accentColor: 'hsl(var(--primary))' }} /><span className="text-sm text-gray-700 group-hover:text-gray-900">Charge Tax</span></label>
                   {isTaxEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100 animate-in fade-in slide-in-from-top-1">
                      <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400">Tax title</label><Input value={taxTitle} onChange={e => setTaxTitle(e.target.value)} placeholder="e.g. SST 10%" className="bg-white text-sm" /></div>
                      <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400">Tax percentage (%)</label><Input type="number" value={taxPercentage || ''} onChange={e => { setTaxPercentage(parseFloat(e.target.value) || 0); setIsTaxManuallyEdited(false); }} placeholder="10" className="bg-white text-sm" /></div>
                      <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400">Tax amount (RM)</label><Input type="number" step="0.01" value={taxAmount || ''} onChange={e => { setTaxAmount(parseFloat(e.target.value) || 0); setIsTaxManuallyEdited(true); }} placeholder="0.00" className="bg-white text-sm" /></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="font-medium">RM {subtotal.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                    {!isFreeDelivery && deliveryFee > 0 && (<div className="flex justify-between text-sm"><span className="text-gray-500">Delivery Fee</span><span className="font-medium">RM {deliveryFee.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>)}
                    {isTaxEnabled && (<div className="flex justify-between text-sm"><span className="text-gray-500">{taxTitle}</span><span className="font-medium">RM {Number(taxAmount).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>)}
                    <div className="flex justify-between items-center border-t pt-2"><span className="font-bold text-gray-900">Total</span><span className="font-bold text-2xl text-primary">RM {totalAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="no-print">
            <Card className="border-none shadow-md sticky top-6">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between"><h2 className="text-xl font-semibold text-gray-900">Preview</h2><div className="text-sm text-gray-500">{docNumberPreview}</div></div>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden"><PDFViewer width="100%" height={900} showToolbar={true}>{pdfDocument}</PDFViewer></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          <p className="text-sm font-medium text-gray-500">Loading invoice editor...</p>
        </div>
      </div>
    }>
      <InvoiceEditor />
    </React.Suspense>
  );
}
