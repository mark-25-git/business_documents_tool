"use client";

import * as React from "react";
import { LineItem } from "@/lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Trash2, Plus } from "lucide-react";

interface LineItemsEditorProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}

export function LineItemsEditor({ items, onChange }: LineItemsEditorProps) {
  const addItem = () => {
    onChange([...items, { description: "", quantity: 1, unitPrice: 0, amount: 0 }]);
  };

  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    
    // Auto-calc amount
    if (field === 'quantity' || field === 'unitPrice') {
      item.amount = Number(item.quantity) * Number(item.unitPrice);
    }
    
    newItems[index] = item;
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-500 mb-2">
        <div className="col-span-6">Description</div>
        <div className="col-span-2">Qty</div>
        <div className="col-span-2">Price</div>
        <div className="col-span-2">Amount</div>
      </div>

      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-12 gap-2 items-start group">
          <div className="col-span-6">
            <Input 
              value={item.description} 
              onChange={e => updateItem(index, 'description', e.target.value)}
              placeholder="Item name"
            />
          </div>
          <div className="col-span-2">
            <Input 
              type="number" 
              min="1"
              value={item.quantity} 
              onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="col-span-2">
            <Input 
              type="number" 
              min="0"
              step="0.01"
              value={item.unitPrice} 
              onChange={e => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="col-span-2 flex gap-2 items-center">
            <div className="flex-1 text-right py-2 font-medium">
              {item.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </div>
            <button 
              onClick={() => removeItem(index)}
              className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      <Button variant="outline" onClick={addItem} className="w-full border-dashed">
        <Plus className="h-4 w-4 mr-2" /> Add Item
      </Button>

      <div className="flex justify-end border-t pt-4 mt-4">
        <div className="text-right">
          <div className="text-sm text-gray-500">Grand Total</div>
          <div className="text-2xl font-bold">
            {total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </div>
        </div>
      </div>
    </div>
  );
}



