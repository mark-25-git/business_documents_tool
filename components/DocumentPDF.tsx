import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';

// Disable hyphenation so addresses wrap by whole words
Font.registerHyphenationCallback(word => [word]);

// Note on font consistency:
// Helvetica is one of the 14 standard PDF base fonts.
// Known issue: Microsoft Edge may substitute Helvetica with Arial when rendering PDFs,
// causing slight visual differences compared to Chrome/other viewers.
// The PDF file itself is correct - this is a rendering issue in Edge's PDF viewer.
// Professional PDF viewers (Adobe Reader, etc.) will display correctly.
// To ensure perfect consistency across all viewers (including Edge), you would need to:
// 1. Obtain Helvetica font files (TTF/OTF) with embedding license
// 2. Register them using Font.register() to force embedding
// 3. Or use a free alternative like Liberation Sans with explicit embedding

type PDFItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount?: number;
};

type PDFCustomer = {
  name: string;
  phone?: string;
  address?: string;
  shippingName?: string;
  shippingAddress?: string;
  shippingPhone?: string;
};

type DocumentPDFProps = {
  docType: string;
  docNumber: string;
  issueDate: string;
  customer: PDFCustomer | null;
  items: PDFItem[];
  currency?: string;
  imageUrl?: string;
  isDeliveryOrder?: boolean;
};

const formatCurrency = (value: number) =>
  `RM ${Number(value || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingLeft: 80,
    paddingRight: 80,
    fontSize: 13, // further +10% (company name unchanged)
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  header: {
    marginBottom: 24,
    lineHeight: 1.2,
  },
  companyName: {
    fontSize: 22, // +10% and fits one line
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#000000',
  },
  companyInfo: {
    fontSize: 10, // +10%
    color: '#000000',
    marginBottom: 2,
    lineHeight: 1.2,
  },
  docType: {
    fontSize: 20, // +10%, still smaller than company name
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#000000',
    letterSpacing: 0.5,
    textTransform: 'none', // Keep sentence case, not uppercase
  },
  billingSection: {
    marginBottom: 12, // Reduced spacing to items table
  },
  billingGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  billingLeft: {
    width: '48%',
    height: 80, // Fixed height so it is not content-driven
  },
  billingRight: {
    width: '48%',
    alignItems: 'flex-end',
  },
  billingRightContainer: {
    width: '100%',
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 11, // +10%
    color: '#000000',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  labelRight: {
    fontSize: 11, // +10%
    color: '#000000',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 12, // +10%
    color: '#000000',
    marginBottom: 4,
    lineHeight: 1.4,
  },
  valueRight: {
    fontSize: 12, // +10%
    color: '#000000',
    marginBottom: 4,
    lineHeight: 1.4,
  },
  itemsTable: {
    marginBottom: 3, // Reduced spacing before totals
    minHeight: 220, // Fits ~8 line items
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  tableHeader: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#D1D5DB',
    paddingTop: 8,
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingTop: 3,
    paddingBottom: 3,
    minHeight: 20,
  },
  colDescription: {
    width: '50%', // 6/12 columns
    paddingRight: 8,
  },
  colQty: {
    width: '16.67%', // 2/12 columns
    textAlign: 'right',
    paddingRight: 8,
  },
  colUnitPrice: {
    width: '16.67%', // 2/12 columns
    textAlign: 'right',
    paddingRight: 8,
  },
  colTotal: {
    width: '16.67%', // 2/12 columns
    textAlign: 'right',
  },
  headerText: {
    fontSize: 11, // +10%
    fontWeight: 'bold',
    color: '#000000',
  },
  rowText: {
    fontSize: 12, // +10%
    color: '#000000',
    lineHeight: 1.4,
  },
  totalsSection: {
    alignItems: 'flex-end',
    marginTop: 3, // Reduced spacing from items table
    width: 256,
    marginLeft: 'auto',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 12, // +10%
    color: '#000000',
  },
  totalLabelStrong: {
    fontSize: 14, // +10%
    color: '#000000',
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 10,
    fontWeight: 'normal', // Unbold for subtotal
    color: '#000000',
  },
  grandTotal: {
    fontSize: 22, // +10%
    fontWeight: 'bold',
    color: '#000000',
  },
  notesSection: {
    marginTop: 16, // Reduced spacing from totals
    fontSize: 10, // +10%
    color: '#000000',
  },
  notesTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  notesText: {
    marginBottom: 0, // Remove space between lines
    lineHeight: 0.95, // Tighten spacing further
  },
  notesIndent: {
    paddingLeft: 24,
    marginBottom: 0, // Remove space between lines
  },
  chopSection: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-start', // align title and image at the top
    gap: 8,
  },
  chopTitle: {
    fontWeight: 'bold',
    marginBottom: 0,
  },
  chopImage: {
    width: 64,  // reduced by 20%
    height: 64, // reduced by 20%
    objectFit: 'contain',
  },
});

export const DocumentPDF: React.FC<DocumentPDFProps> = ({
  docType,
  docNumber,
  issueDate,
  customer,
  items,
  currency = "MYR",
  imageUrl,
  isDeliveryOrder: isDeliveryOrderProp,
}) => {
  const isDeliveryOrder = isDeliveryOrderProp ?? (
    docType.trim().toLowerCase() === "delivery order" ||
    docType.trim().toLowerCase() === "delivery order."
  );
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
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>PERABOT MEGAH ENTERPRISE</Text>
          <Text style={styles.companyInfo}>NO. 202503044871 (JR0174054-W)</Text>
          <Text style={styles.companyInfo}>NO.12 , TAMAN PERDANA , JALAN BAKRI , 84000 MUAR, JOHOR.</Text>
          <Text style={styles.companyInfo}>perabotmegah@gmail.com</Text>
        </View>

        {/* Document Type - sentence case */}
        <Text style={styles.docType}>{docType}</Text>

        {/* Billing Section */}
        <View style={styles.billingSection}>
          <View style={styles.billingGrid}>
            <View style={styles.billingLeft}>
              <Text style={styles.label}>{isDeliveryOrder ? 'Ship To' : 'To'}</Text>
              {customer ? (
                <>
                  {(() => {
                    const resolvedName = isDeliveryOrder
                      ? (customer.shippingName?.trim() || customer.name?.trim())
                      : customer.name?.trim();

                    const resolvedPhone = isDeliveryOrder
                      ? (customer.shippingPhone?.trim() || customer.phone?.trim())
                      : customer.phone?.trim();

                    const resolvedAddress = isDeliveryOrder
                      ? (customer.shippingAddress?.trim() || customer.address?.trim())
                      : customer.address?.trim();

                    return (
                      <>
                        <Text style={styles.value}>{resolvedName}</Text>
                        {resolvedPhone && (
                          <Text style={styles.value}>{resolvedPhone}</Text>
                        )}
                        {resolvedAddress && (
                          <Text style={styles.value}>{resolvedAddress}</Text>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                <Text style={styles.value}>No customer selected</Text>
              )}
            </View>

            <View style={styles.billingRight}>
              <View style={{ marginBottom: 12, alignItems: 'flex-end' }}>
                <Text style={styles.labelRight}>{docType} No.</Text>
                <Text style={styles.valueRight}>{docNumber || "AUTO"}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.labelRight}>Issue Date</Text>
                <Text style={styles.valueRight}>
                  {issueDate ? new Date(issueDate).toLocaleDateString("en-GB") : "—"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.itemsTable}>
          <View>
            <View style={styles.tableHeader}>
              <View style={styles.colDescription}>
                <Text style={styles.headerText}>Description</Text>
              </View>
              {!isDeliveryOrder && (
                <View style={styles.colQty}>
                  <Text style={styles.headerText}>Qty</Text>
                </View>
              )}
              {!isDeliveryOrder && (
                <>
                  <View style={styles.colUnitPrice}>
                    <Text style={styles.headerText}>Unit Price</Text>
                  </View>
                  <View style={styles.colTotal}>
                    <Text style={styles.headerText}>Total Price</Text>
                  </View>
                </>
              )}
              {isDeliveryOrder && (
                <View
                  style={{
                    width: '16.67%',
                    marginLeft: 'auto',
                    textAlign: 'right',
                    paddingRight: 0,
                  }}
                >
                  <Text style={styles.headerText}>Qty</Text>
                </View>
              )}
            </View>

            {items.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={styles.rowText}>No items</Text>
              </View>
            ) : (
              items.map((item, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <View style={styles.colDescription}>
                    <Text style={styles.rowText}>{item.description}</Text>
                  </View>
                  {!isDeliveryOrder && (
                    <View style={styles.colQty}>
                      <Text style={styles.rowText}>{item.quantity}</Text>
                    </View>
                  )}
                  {!isDeliveryOrder && (
                    <>
                      <View style={styles.colUnitPrice}>
                        <Text style={styles.rowText}>
                          {formatCurrency(Number(item.unitPrice || 0))}
                        </Text>
                      </View>
                      <View style={styles.colTotal}>
                        <Text style={styles.rowText}>
                          {formatCurrency(
                            Number(
                              item.amount ??
                              Number(item.quantity || 0) * Number(item.unitPrice || 0)
                            )
                          )}
                        </Text>
                      </View>
                    </>
                  )}
                  {isDeliveryOrder && (
                    <View
                      style={{
                        width: '16.67%',
                        marginLeft: 'auto',
                        textAlign: 'right',
                        paddingRight: 0,
                      }}
                    >
                      <Text style={styles.rowText}>{item.quantity}</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
          {/* Separator at bottom of items table container */}
          <View style={{ borderBottomWidth: 1, borderBottomColor: '#D1D5DB' }} />
        </View>

        {/* Totals (hidden for Delivery Order) */}
        {!isDeliveryOrder && (
          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabelStrong}>Total</Text>
              <Text style={styles.grandTotal}>{formatCurrency(total)}</Text>
            </View>
          </View>
        )}

        {/* Notes */}
        <View style={styles.notesSection}>
          {!isDeliveryOrder ? (
            <>
              <Text style={styles.notesTitle}>Terms:</Text>
              <Text style={styles.notesText}>All goods sold are non-returnable and non-refundable.</Text>
              <Text style={styles.notesText}>All payment be bank transfer should be made to the following bank details.</Text>
              <Text style={[styles.notesText, styles.notesIndent]}>PERABOT MEGAH ENTERPRISE</Text>
              <Text style={[styles.notesText, styles.notesIndent]}>Public Bank (A/C NO: 3242595608)</Text>
            </>
          ) : (
            // Keep vertical spacing similar for Delivery Order but without terms text
            <Text style={{ marginBottom: 24 }}></Text>
          )}

          {/* Signatures */}
          {isDeliveryOrder ? (
            <View
              style={[
                styles.chopSection,
                { justifyContent: 'space-between', marginTop: 24 },
              ]}
            >
              <View>
                <Text style={styles.chopTitle}>Issued by</Text>
                {imageUrl && (
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Image src={imageUrl} style={styles.chopImage} />
                  </View>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.chopTitle}>Received by</Text>
                <View style={{ height: 80 }} />
                <View
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: '#000000',
                    width: 90,
                  }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.chopSection}>
              <Text style={styles.chopTitle}>Issued by</Text>
              {imageUrl && (
                <View
                  style={{
                    width: 80,
                    height: 80,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Image src={imageUrl} style={styles.chopImage} />
                </View>
              )}
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
};

