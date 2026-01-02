"use client";

import * as React from "react";
import { getCustomers, createCustomer, updateCustomer } from "@/lib/api";
import { Customer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Plus, Search, Edit2, Save, X, Phone, Mail, MapPin, Truck, Receipt } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function CustomersPage() {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  // New Customer Form
  const [newCustomer, setNewCustomer] = React.useState<Omit<Customer, 'id'>>({
    name: "", phone: "", address: "", email: "",
    billingAddress: "", billingPhone: "", billingEmail: "",
    shippingName: "", shippingAddress: "", shippingPhone: ""
  });

  // Edit State
  const [editForm, setEditForm] = React.useState<Customer | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    const data = await getCustomers();
    setCustomers(data);
    setLoading(false);
  };

  React.useEffect(() => {
    fetchCustomers();
  }, []);

  const handleAdd = async () => {
    if (!newCustomer.name) return;
    const res = await createCustomer(newCustomer);
    if (res.success) {
      setIsAdding(false);
      setNewCustomer({
        name: "", phone: "", address: "", email: "",
        billingAddress: "", billingPhone: "", billingEmail: "",
        shippingName: "", shippingAddress: "", shippingPhone: ""
      });
      fetchCustomers();
    } else {
      alert("Failed to add customer");
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setEditForm({
      ...customer,
      billingAddress: customer.billingAddress || customer.address,
      billingPhone: customer.billingPhone || customer.phone,
      billingEmail: customer.billingEmail || customer.email,
      shippingName: customer.shippingName || customer.name,
      shippingAddress: customer.shippingAddress || customer.address,
      shippingPhone: customer.shippingPhone || customer.phone
    });
  };

  const handleSave = async () => {
    if (!editForm) return;
    const res = await updateCustomer(editForm);
    if (res.success) {
      setEditingId(null);
      setEditForm(null);
      fetchCustomers();
    } else {
      alert("Failed to update customer");
    }
  };

  // Phone number formatting function
  const formatPhoneNumber = (input: string): string => {
    if (!input) return '';
    let digits = input.replace(/\D/g, '');
    const originalLength = digits.length;
    const hadLeadingZero = digits.startsWith('0');
    if (digits.startsWith('60') && digits.length >= 10) {
      digits = '0' + digits.substring(2);
    }
    if (!digits.startsWith('0')) {
      if (digits.length >= 8 && digits.length <= 10) {
        digits = '0' + digits;
      } else {
        return digits;
      }
    }
    if (digits.startsWith('088') || digits.startsWith('089')) {
      if (digits.length >= 8 && digits.length <= 11) {
        return `${digits.substring(0, 3)}-${digits.substring(3)}`;
      }
    }
    if (originalLength === 8 && !hadLeadingZero && digits.length === 9 && digits.startsWith('01')) {
      return `${digits.substring(0, 2)}-${digits.substring(2)}`;
    }
    if (digits.startsWith('01') && !digits.startsWith('011') && !digits.startsWith('088') && !digits.startsWith('089')) {
      if (digits.length >= 9 && digits.length <= 11) {
        return `${digits.substring(0, 3)}-${digits.substring(3)}`;
      }
    }
    if (digits.length === 8) {
      return `${digits.substring(0, 2)}-${digits.substring(2)}`;
    }
    if (!digits.startsWith('01') && digits.length >= 9 && digits.length <= 11) {
      return `${digits.substring(0, 2)}-${digits.substring(2)}`;
    }
    if (digits.startsWith('011') && digits.length >= 9 && digits.length <= 11) {
      return `${digits.substring(0, 3)}-${digits.substring(3)}`;
    }
    return digits;
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-gray-200 rounded-full">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Customers</h1>
              <p className="text-sm text-gray-500">Manage your client profiles and defaults</p>
            </div>
          </div>
          <Button onClick={() => setIsAdding(!isAdding)} className="shadow-sm">
            {isAdding ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {isAdding ? "Cancel" : "New Customer"}
          </Button>
        </div>

        {isAdding && (
          <Card className="border-2 border-primary/10 shadow-lg animate-in fade-in slide-in-from-top-4">
            <CardHeader>
              <CardTitle>Create New Profile</CardTitle>
              <CardDescription>Enter primary contact details for the new customer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-400">Primary Name</label>
                  <Input placeholder="E.g. Bing Bing Polite Bakery" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-400">Phone</label>
                  <Input placeholder="Primary Contact" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-400">Email</label>
                  <Input placeholder="Primary Email" value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-400">Legacy Address</label>
                  <Input placeholder="Primary Address" value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setIsAdding(false)}>Discard</Button>
                <Button onClick={handleAdd}>Save Customer</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="relative group">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search by name or contact..."
            className="pl-10 bg-white shadow-sm ring-1 ring-gray-200 border-none focus-visible:ring-2 focus-visible:ring-primary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-gray-200 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
            <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
              <Search className="h-full w-full" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No customers found</h3>
            <p className="text-gray-500 max-w-xs mx-auto mt-1">Try adjusting your search or add a new customer to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
            {filtered.map((customer) => (
              <Card key={customer.id || `temp-${customer.name}`} className={`overflow-hidden transition-all duration-300 ${editingId === (customer.id || '') && customer.id ? 'ring-2 ring-primary shadow-xl scale-[1.01]' : 'hover:shadow-md border-gray-200'}`}>
                <CardHeader className="bg-white pb-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      {editingId === customer.id ? (
                        <Input
                          value={editForm?.name}
                          onChange={e => setEditForm(f => f ? { ...f, name: e.target.value } : null)}
                          className="font-bold text-lg h-8 mb-1"
                        />
                      ) : (
                        <CardTitle className="text-xl font-bold text-gray-900">{customer.name}</CardTitle>
                      )}
                      <div className="flex gap-2 text-xs">
                        <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">ID: {customer.id}</Badge>
                      </div>
                    </div>
                    {editingId === customer.id ? (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} className="h-8 w-8 text-gray-400">
                          <X className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="default" onClick={handleSave} className="h-8 w-8">
                          <Save className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(customer)} className="h-8 w-8 text-gray-400 hover:text-primary">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  {/* Primary Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-3.5 w-3.5" />
                      {editingId === customer.id ? (
                        <input className="bg-transparent border-b border-gray-300 w-full outline-none" value={editForm?.phone} onChange={e => setEditForm(f => f ? { ...f, phone: formatPhoneNumber(e.target.value) } : null)} />
                      ) : (
                        <span>{customer.phone || 'No phone'}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-3.5 w-3.5" />
                      {editingId === customer.id ? (
                        <input className="bg-transparent border-b border-gray-300 w-full outline-none" value={editForm?.email} onChange={e => setEditForm(f => f ? { ...f, email: e.target.value } : null)} />
                      ) : (
                        <span className="truncate">{customer.email || 'No email'}</span>
                      )}
                    </div>
                  </div>

                  {/* Dual Address Defaults */}
                  <div className="space-y-3">
                    {/* Billing Default */}
                    <div className="space-y-1.5 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        <Receipt className="h-3 w-3" /> Billing Default
                      </div>
                      {editingId === customer.id ? (
                        <div className="space-y-1">
                          <Input className="text-xs h-7" placeholder="Billing Name" value={editForm?.name} disabled />
                          <Input className="text-xs h-7" placeholder="Billing Phone" value={editForm?.billingPhone} onChange={e => setEditForm(f => f ? { ...f, billingPhone: formatPhoneNumber(e.target.value) } : null)} />
                          <Input className="text-xs h-7" placeholder="Billing Address" value={editForm?.billingAddress} onChange={e => setEditForm(f => f ? { ...f, billingAddress: e.target.value } : null)} />
                        </div>
                      ) : (
                        <div className="text-sm">
                          <div className="font-semibold text-gray-700">{customer.name}</div>
                          <div className="text-gray-500 leading-tight mt-0.5">{customer.billingAddress || customer.address}</div>
                          <div className="text-gray-400 text-xs mt-0.5">{customer.billingPhone || customer.phone}</div>
                        </div>
                      )}
                    </div>

                    {/* Shipping Default */}
                    <div className="space-y-1.5 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-blue-500 uppercase tracking-wider">
                        <Truck className="h-3 w-3" /> Shipping Default
                      </div>
                      {editingId === customer.id ? (
                        <div className="space-y-1">
                          <Input className="text-xs h-7 border-blue-100 focus-visible:ring-blue-400" placeholder="Shipping Name" value={editForm?.shippingName} onChange={e => setEditForm(f => f ? { ...f, shippingName: e.target.value } : null)} />
                          <Input className="text-xs h-7 border-blue-100 focus-visible:ring-blue-400" placeholder="Shipping Phone" value={editForm?.shippingPhone} onChange={e => setEditForm(f => f ? { ...f, shippingPhone: formatPhoneNumber(e.target.value) } : null)} />
                          <Input className="text-xs h-7 border-blue-100 focus-visible:ring-blue-400" placeholder="Shipping Address" value={editForm?.shippingAddress} onChange={e => setEditForm(f => f ? { ...f, shippingAddress: e.target.value } : null)} />
                        </div>
                      ) : (
                        <div className="text-sm">
                          <div className="font-semibold text-gray-700">{customer.shippingName || customer.name}</div>
                          <div className="text-gray-500 leading-tight mt-0.5">{customer.shippingAddress || customer.address}</div>
                          <div className="text-gray-400 text-xs mt-0.5">{customer.shippingPhone || customer.phone}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
        }

      </div >
    </div >
  );
}



