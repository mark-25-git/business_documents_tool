"use client";

import * as React from "react";
import { getDocuments, deleteDocument, getDocument } from "@/lib/api";
import { InvoiceDocument } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LineItemsTooltip } from "@/components/LineItemsTooltip";
import { ArrowLeft, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DocumentsPage() {
  const router = useRouter();
  const [docs, setDocs] = React.useState<InvoiceDocument[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [deleteDialog, setDeleteDialog] = React.useState<{ open: boolean; docId: string | null; docNumber: string | null }>({
    open: false,
    docId: null,
    docNumber: null
  });
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deletingRowId, setDeletingRowId] = React.useState<string | null>(null);
  
  // Tooltip state
  const [hoveredDocId, setHoveredDocId] = React.useState<string | null>(null);
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });
  const [documentCache, setDocumentCache] = React.useState<Map<string, InvoiceDocument>>(new Map());
  const [loadingDocId, setLoadingDocId] = React.useState<string | null>(null);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    getDocuments().then(data => {
      setDocs(data);
      setLoading(false);
    });
  }, []);

  const filtered = docs.filter(d => 
    d.customerName.toLowerCase().includes(search.toLowerCase()) || 
    d.docNumber.toLowerCase().includes(search.toLowerCase())
  );

  const handleDeleteClick = (e: React.MouseEvent, docId: string, docNumber: string) => {
    e.stopPropagation(); // Prevent row click
    setDeleteDialog({ open: true, docId, docNumber });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.docId) return;

    setIsDeleting(true);
    const result = await deleteDocument(deleteDialog.docId);
    setIsDeleting(false);

    if (result && result.success) {
      const docIdToDelete = deleteDialog.docId;
      
      // Auto-close dialog immediately
      setDeleteDialog({ open: false, docId: null, docNumber: null });
      
      // Start fade-out animation
      setDeletingRowId(docIdToDelete);
      
      // Wait for animation to complete (1000ms), then remove from state
      // This allows the row to fade out and collapse before being removed
      setTimeout(() => {
        setDocs(docs.filter(d => d.id !== docIdToDelete));
        setDeletingRowId(null);
      }, 1000);
    } else {
      const errorMsg = result?.error || result?.message || "Unknown error. Please make sure the Google Apps Script is updated with the deleteDocument function.";
      alert("Failed to delete document: " + errorMsg);
      setDeleteDialog({ open: false, docId: null, docNumber: null });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, docId: null, docNumber: null });
  };

  const handleRowMouseEnter = (e: React.MouseEvent, docId: string) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Update mouse position
    setMousePosition({ x: e.clientX, y: e.clientY });

    // Debounce: Wait 300ms before showing tooltip
    hoverTimeoutRef.current = setTimeout(async () => {
      setHoveredDocId(docId);
      
      // Check cache first
      if (documentCache.has(docId)) {
        return;
      }

      // Fetch document details
      setLoadingDocId(docId);
      const doc = await getDocument(docId);
      if (doc) {
        setDocumentCache(prev => new Map(prev).set(docId, doc));
      }
      setLoadingDocId(null);
    }, 300);
  };

  const handleRowMouseMove = (e: React.MouseEvent) => {
    if (hoveredDocId) {
      setMousePosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleRowMouseLeave = () => {
    // Clear timeout if still waiting
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredDocId(null);
    setLoadingDocId(null);
  };

  // Track mouse movement globally when tooltip is visible
  React.useEffect(() => {
    if (!hoveredDocId) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [hoveredDocId]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-gray-200 rounded-full">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          </div>
          <Link href="/documents/new-simple">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New Document
            </Button>
          </Link>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Search by customer or document number..." 
            className="pl-10 bg-white" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-lg shadow border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading documents...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No documents found.</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 font-medium text-gray-500">Date</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Number</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Type</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Customer</th>
                  <th className="px-6 py-3 font-medium text-gray-500 text-right">Total</th>
                  <th className="px-6 py-3 font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((doc) => (
                  <tr 
                    key={doc.id} 
                    className={`hover:bg-gray-50 cursor-pointer ${
                      deletingRowId === doc.id 
                        ? 'row-deleting pointer-events-none' 
                        : ''
                    }`}
                    onClick={() => deletingRowId !== doc.id && router.push(`/documents/${doc.id}`)}
                    onMouseEnter={(e) => !deletingRowId && handleRowMouseEnter(e, doc.id)}
                    onMouseMove={handleRowMouseMove}
                    onMouseLeave={handleRowMouseLeave}
                  >
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(doc.date).toLocaleDateString('en-GB', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric' 
                      })}
                    </td>
                    <td className="px-6 py-4 text-gray-900 font-medium">{doc.docNumber}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded font-medium 
                        ${doc.type === 'INVOICE' ? 'bg-blue-100 text-blue-700' : 
                          doc.type === 'QUOTATION' ? 'bg-orange-100 text-orange-700' : 
                          'bg-green-100 text-green-700'}`}>
                        {doc.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{doc.customerName}</td>
                    <td className="px-6 py-4 text-right font-medium">
                      RM {doc.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => handleDeleteClick(e, doc.id, doc.docNumber)}
                        className="p-2 hover:bg-red-50 rounded text-red-600 hover:text-red-700 transition-colors"
                        title="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* Line Items Tooltip */}
      {hoveredDocId && (
        <LineItemsTooltip
          items={documentCache.get(hoveredDocId)?.items || null}
          loading={loadingDocId === hoveredDocId}
          mouseX={mousePosition.x}
          mouseY={mousePosition.y}
        />
      )}

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Document"
        message={`Are you sure you want to delete document ${deleteDialog.docNumber}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        loading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}



