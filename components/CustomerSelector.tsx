"use client";

import * as React from "react";
import { Customer } from "@/lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { PlusCircle, Search } from "lucide-react";
import { createCustomer } from "@/lib/api";
import { cn } from "@/lib/utils";

interface CustomerSelectorProps {
  customers: Customer[];
  onSelect: (customer: Customer) => void;
  selectedId?: string;
}

export function CustomerSelector({ customers, onSelect, selectedId }: CustomerSelectorProps) {
  const [search, setSearch] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);
  const [newCustomer, setNewCustomer] = React.useState({ name: "", phone: "", address: "", email: "" });

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  const handleAdd = async () => {
    if (!newCustomer.name) return;
    
    // Optimistic add (in real app, wait for ID)
    // Here we just call API
    const res = await createCustomer(newCustomer);
    if (res.success) {
      const added = { ...newCustomer, id: res.id, createdAt: new Date().toISOString() };
      onSelect(added);
      setIsAdding(false);
      // Note: Parent should refresh list in real app
    }
  };

  if (isAdding) {
    return (
      <div className="space-y-3 p-4 border rounded-md bg-gray-50">
        <h4 className="font-medium">New Customer</h4>
        <Input placeholder="Name" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
        <Input placeholder="Phone" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
        <Input placeholder="Email" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} />
        <Input placeholder="Address" value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleAdd}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search customers..." 
            className="pl-8" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => setIsAdding(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          New
        </Button>
      </div>

      {search && (
        <div className="border rounded-md max-h-40 overflow-y-auto bg-white">
          {filtered.length === 0 ? (
            <div className="p-2 text-sm text-gray-500">No customers found</div>
          ) : (
            filtered.map(c => (
              <div 
                key={c.id}
                className={cn(
                  "p-2 text-sm cursor-pointer hover:bg-gray-100 flex justify-between",
                  selectedId === c.id && "bg-blue-50 text-blue-700"
                )}
                onClick={() => {
                  onSelect(c);
                  setSearch(""); // clear search on select
                }}
              >
                <span>{c.name}</span>
                <span className="text-gray-400 text-xs">{c.phone}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}



