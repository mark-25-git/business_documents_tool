/**
 * BACKEND CODE FOR GOOGLE SHEETS (HIGH PERFORMANCE & LOW LATENCY EDITION)
 * Copy and paste this into your Google Apps Script editor (Extensions > Apps Script)
 * then click Deploy > New deployment (Web app, Execute as Me, Access: Anyone).
 */

const SHEETS = {
  DOCUMENTS: 'Documents',
  LINE_ITEMS: 'LineItems',
  CUSTOMERS: 'Customers'
};

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Create Documents Sheet
  if (!ss.getSheetByName(SHEETS.DOCUMENTS)) {
    const s = ss.insertSheet(SHEETS.DOCUMENTS);
    s.appendRow(['DocID', 'DocNumber', 'Type', 'Date', 'CustomerID', 'CustomerName', 'TotalAmount', 'Status', 'Notes', 'CreatedAt', 'BillingAddress', 'BillingPhone', 'BillingEmail', 'ShippingName', 'ShippingAddress', 'ShippingPhone', 'DeliveryFee', 'IsFreeDelivery']);
    s.setFrozenRows(1);
  } else {
    const s = ss.getSheetByName(SHEETS.DOCUMENTS);
    const headers = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
    const newHeaders = ['BillingAddress', 'BillingPhone', 'BillingEmail', 'ShippingName', 'ShippingAddress', 'ShippingPhone', 'DeliveryFee', 'IsFreeDelivery'];

    newHeaders.forEach(header => {
      if (headers.map(h => h.toLowerCase()).indexOf(header.toLowerCase()) === -1) {
        s.getRange(1, s.getLastColumn() + 1).setValue(header);
      }
    });
  }

  // Create LineItems Sheet
  if (!ss.getSheetByName(SHEETS.LINE_ITEMS)) {
    const s = ss.insertSheet(SHEETS.LINE_ITEMS);
    s.appendRow(['ItemID', 'DocID', 'Description', 'Quantity', 'UnitPrice', 'Amount']);
    s.setFrozenRows(1);
  }

  // Create Customers Sheet
  if (!ss.getSheetByName(SHEETS.CUSTOMERS)) {
    const s = ss.insertSheet(SHEETS.CUSTOMERS);
    s.appendRow(['CustomerID', 'Name', 'Phone', 'Address', 'Email', 'CreatedAt', 'BillingAddress', 'BillingPhone', 'BillingEmail', 'ShippingName', 'ShippingAddress', 'ShippingPhone']);
    s.setFrozenRows(1);
  } else {
    const s = ss.getSheetByName(SHEETS.CUSTOMERS);
    const headers = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
    const newHeaders = ['BillingAddress', 'BillingPhone', 'BillingEmail', 'ShippingName', 'ShippingAddress', 'ShippingPhone'];

    newHeaders.forEach(header => {
      if (headers.map(h => h.toLowerCase()).indexOf(header.toLowerCase()) === -1) {
        s.getRange(1, s.getLastColumn() + 1).setValue(header);
      }
    });
  }
}

function handleRequest(e) {
  try {
    let action = e && e.parameter && e.parameter.action;
    let data = {};

    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = {};
      }
    }

    if (!action && data && data.action) {
      action = data.action;
    }

    switch (action) {
      case 'getCustomers':
        return getCustomers();
      case 'createCustomer':
        return createCustomer(data);
      case 'updateCustomer':
        return updateCustomer(data);
      case 'deleteCustomer':
        return deleteCustomer(data.id || (e.parameter && e.parameter.id));
      case 'getDocuments':
        return getDocuments();
      case 'getDocument':
        return getDocument(data.id || (e.parameter && e.parameter.id));
      case 'createDocument':
        return createDocument(data);
      case 'updateDocument':
        return updateDocument(data);
      case 'deleteDocument':
        return deleteDocument(data.id || (e.parameter && e.parameter.id));
      case 'recoverDocument':
        return recoverDocument(data.id || (e.parameter && e.parameter.id));
      case 'getItemSuggestions':
        return getItemSuggestions();
      case 'getNextDocNumber':
        return getNextDocNumber();
      case 'clearAllData':
        return clearAllData();
      default:
        return response({ success: false, error: 'Invalid action: ' + action });
    }
  } catch (err) {
    return response({ success: false, error: err.toString() });
  }
}

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

// --- CRUD SERVICE FUNCTIONS ---

function getCustomers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CUSTOMERS);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return response({ success: true, data: [] });

  const headers = data.shift().map(h => h.toString().trim().toLowerCase());
  const idx = name => headers.indexOf(name.toLowerCase());

  const customers = data.map(row => ({
    id: row[idx('customerid')],
    name: row[idx('name')],
    phone: row[idx('phone')] || '',
    address: row[idx('address')] || '',
    email: row[idx('email')] || '',
    billingAddress: idx('billingaddress') !== -1 ? (row[idx('billingaddress')] || '') : '',
    billingPhone: idx('billingphone') !== -1 ? (row[idx('billingphone')] || '') : '',
    billingEmail: idx('billingemail') !== -1 ? (row[idx('billingemail')] || '') : '',
    shippingName: idx('shippingname') !== -1 ? (row[idx('shippingname')] || '') : '',
    shippingAddress: idx('shippingaddress') !== -1 ? (row[idx('shippingaddress')] || '') : '',
    shippingPhone: idx('shippingphone') !== -1 ? (row[idx('shippingphone')] || '') : '',
    createdAt: row[idx('createdat')] || ''
  }));

  return response({ success: true, data: customers });
}

function createCustomer(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CUSTOMERS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().trim().toLowerCase());
  const idx = name => headers.indexOf(name.toLowerCase());

  const id = data.id || ('CUST-' + new Date().getTime());
  const row = new Array(headers.length).fill('');

  const mapping = {
    'customerid': id,
    'name': data.name,
    'phone': data.phone || '',
    'address': data.address || '',
    'email': data.email || '',
    'createdat': data.createdAt || new Date().toISOString(),
    'billingaddress': data.billingAddress || data.address || '',
    'billingphone': data.billingPhone || data.phone || '',
    'billingemail': data.billingEmail || data.email || '',
    'shippingname': data.shippingName || data.name || '',
    'shippingaddress': data.shippingAddress || data.address || '',
    'shippingphone': data.shippingPhone || data.phone || ''
  };

  Object.keys(mapping).forEach(key => {
    const colIdx = idx(key);
    if (colIdx !== -1) row[colIdx] = mapping[key];
  });

  sheet.appendRow(row);
  return response({ success: true, id: id });
}

function updateCustomer(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CUSTOMERS);
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return response({ success: false, error: 'Customer not found' });

  const headers = rows[0].map(h => h.toString().trim().toLowerCase());
  const idx = name => headers.indexOf(name.toLowerCase());
  const idColIdx = idx('customerid');

  if (idColIdx === -1) return response({ success: false, error: 'CustomerID column not found' });

  const customerId = data.id;
  let rowIndex = -1;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idColIdx] === customerId) {
      rowIndex = i + 1; // 1-indexed
      break;
    }
  }

  if (rowIndex === -1) return response({ success: false, error: 'Customer not found' });

  // Update target row array in memory for single-call write performance
  const targetRow = rows[rowIndex - 1];
  const updateMap = {
    'name': data.name,
    'phone': data.phone,
    'address': data.address,
    'email': data.email,
    'billingaddress': data.billingAddress,
    'billingphone': data.billingPhone,
    'billingemail': data.billingEmail,
    'shippingname': data.shippingName,
    'shippingaddress': data.shippingAddress,
    'shippingphone': data.shippingPhone
  };

  Object.keys(updateMap).forEach(key => {
    const colIdx = idx(key);
    if (colIdx !== -1 && updateMap[key] !== undefined) {
      targetRow[colIdx] = updateMap[key];
    }
  });

  // Fast single batch range update
  sheet.getRange(rowIndex, 1, 1, targetRow.length).setValues([targetRow]);
  return response({ success: true });
}

function deleteCustomer(customerId) {
  if (!customerId) return response({ success: false, error: 'CustomerID is required' });

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CUSTOMERS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => h.toString().trim().toLowerCase());
  const idColIdx = headers.indexOf('customerid');

  if (idColIdx === -1) return response({ success: false, error: 'CustomerID column not found' });

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idColIdx] === customerId) {
      sheet.deleteRow(i + 1);
      return response({ success: true });
    }
  }

  return response({ success: false, error: 'Customer not found' });
}

function getDocuments() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.DOCUMENTS);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return response({ success: true, data: [] });

  const headers = data.shift().map(h => h.toString().trim().toLowerCase());
  const idx = name => headers.indexOf(name.toLowerCase());

  const docs = data.map(row => ({
    id: row[idx('docid')],
    docNumber: row[idx('docnumber')],
    type: row[idx('type')],
    date: row[idx('date')],
    customerId: row[idx('customerid')],
    customerName: row[idx('customername')],
    totalAmount: Number(row[idx('totalamount')] || 0),
    status: row[idx('status')],
    deliveryFee: idx('deliveryfee') !== -1 ? Number(row[idx('deliveryfee')] || 0) : 0,
    isFreeDelivery: idx('isfreedelivery') !== -1 ? Boolean(row[idx('isfreedelivery')]) : false
  })).reverse(); // Return newest first

  return response({ success: true, data: docs });
}

function getDocument(docId) {
  if (!docId) return response({ success: false, error: 'Document ID is required' });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTS);
  const itemSheet = ss.getSheetByName(SHEETS.LINE_ITEMS);

  const docRows = docSheet.getDataRange().getValues();
  if (docRows.length <= 1) return response({ success: false, error: 'Document not found' });

  const headers = docRows[0].map(h => h.toString().trim().toLowerCase());
  const idx = name => headers.indexOf(name.toLowerCase());
  const idColIdx = idx('docid');

  let docRow = null;
  for (let i = 1; i < docRows.length; i++) {
    if (docRows[i][idColIdx] === docId) {
      docRow = docRows[i];
      break;
    }
  }

  if (!docRow) return response({ success: false, error: 'Document not found' });

  const doc = {
    id: docRow[idx('docid')],
    docNumber: docRow[idx('docnumber')],
    type: docRow[idx('type')],
    date: docRow[idx('date')],
    customerId: docRow[idx('customerid')],
    customerName: docRow[idx('customername')],
    totalAmount: Number(docRow[idx('totalamount')] || 0),
    status: docRow[idx('status')],
    notes: idx('notes') !== -1 ? (docRow[idx('notes')] || '') : '',
    billingAddress: idx('billingaddress') !== -1 ? (docRow[idx('billingaddress')] || '') : '',
    billingPhone: idx('billingphone') !== -1 ? (docRow[idx('billingphone')] || '') : '',
    billingEmail: idx('billingemail') !== -1 ? (docRow[idx('billingemail')] || '') : '',
    shippingName: idx('shippingname') !== -1 ? (docRow[idx('shippingname')] || '') : '',
    shippingAddress: idx('shippingaddress') !== -1 ? (docRow[idx('shippingaddress')] || '') : '',
    shippingPhone: idx('shippingphone') !== -1 ? (docRow[idx('shippingphone')] || '') : '',
    deliveryFee: idx('deliveryfee') !== -1 ? Number(docRow[idx('deliveryfee')] || 0) : 0,
    isFreeDelivery: idx('isfreedelivery') !== -1 ? Boolean(docRow[idx('isfreedelivery')]) : false
  };

  // Fetch Line Items
  const itemData = itemSheet.getDataRange().getValues();
  itemData.shift(); // remove header
  const items = itemData
    .filter(row => row[1] === docId)
    .map(row => ({
      id: row[0],
      docId: row[1],
      description: row[2],
      quantity: Number(row[3] || 1),
      unitPrice: Number(row[4] || 0),
      amount: Number(row[5] || 0)
    }));

  return response({ success: true, data: { ...doc, items } });
}

function createDocument(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTS);
  const itemSheet = ss.getSheetByName(SHEETS.LINE_ITEMS);

  let docNumber = data.docNumber;
  const docRows = docSheet.getDataRange().getValues();
  const headers = docRows[0].map(h => h.toString().trim().toLowerCase());
  const idx = name => headers.indexOf(name.toLowerCase());

  if (docNumber) {
    const docNumIdx = idx('docnumber');
    const existing = docRows.slice(1).some(r => r[docNumIdx] === docNumber && r[idx('docid')] !== data.id);
    if (existing) {
      return response({ success: false, error: 'Document number already exists: ' + docNumber });
    }
  } else {
    docNumber = generateDocNumber(data.type);
  }

  const docId = data.id || ('DOC-' + new Date().getTime());
  const row = new Array(headers.length).fill('');

  const mapping = {
    'docid': docId,
    'docnumber': docNumber,
    'type': data.type,
    'date': data.date,
    'customerid': data.customerId,
    'customername': data.customerName,
    'totalamount': data.totalAmount,
    'status': data.status,
    'notes': data.notes || '',
    'createdat': data.createdAt || new Date().toISOString(),
    'billingaddress': data.billingAddress || '',
    'billingphone': data.billingPhone || '',
    'billingemail': data.billingEmail || '',
    'shippingname': data.shippingName || '',
    'shippingaddress': data.shippingAddress || '',
    'shippingphone': data.shippingPhone || '',
    'deliveryfee': data.deliveryFee || 0,
    'isfreedelivery': data.isFreeDelivery ? true : false
  };

  Object.keys(mapping).forEach(key => {
    const colIdx = idx(key);
    if (colIdx !== -1) row[colIdx] = mapping[key];
  });

  docSheet.appendRow(row);

  // Batch insert line items
  if (data.items && data.items.length > 0) {
    const items = data.items.map(item => [
      item.id || ('ITEM-' + Math.random().toString(36).substr(2, 9)),
      docId,
      item.description,
      item.quantity,
      item.unitPrice,
      item.amount
    ]);
    itemSheet.getRange(itemSheet.getLastRow() + 1, 1, items.length, items[0].length).setValues(items);
  }

  if (data.syncToMaster && data.customerId && !data.customerId.startsWith('TEMP-')) {
    updateCustomer({
      id: data.customerId,
      name: data.customerName,
      billingAddress: data.billingAddress,
      billingPhone: data.billingPhone,
      billingEmail: data.billingEmail,
      shippingName: data.shippingName,
      shippingAddress: data.shippingAddress,
      shippingPhone: data.shippingPhone
    });
  }

  return response({ success: true, docId: docId, docNumber: docNumber });
}

function updateDocument(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTS);
  const itemSheet = ss.getSheetByName(SHEETS.LINE_ITEMS);

  const docId = data.id;
  if (!docId) return response({ success: false, error: 'Document ID is required' });

  const docRows = docSheet.getDataRange().getValues();
  if (docRows.length <= 1) return response({ success: false, error: 'Document not found' });

  const headers = docRows[0].map(h => h.toString().trim().toLowerCase());
  const idx = name => headers.indexOf(name.toLowerCase());
  const idColIdx = idx('docid');

  let rowIndex = -1;
  for (let i = 1; i < docRows.length; i++) {
    if (docRows[i][idColIdx] === docId) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) return response({ success: false, error: 'Document not found' });

  // Update target row array in memory for batch update
  const targetRow = docRows[rowIndex - 1];
  const mapping = {
    'docnumber': data.docNumber,
    'type': data.type,
    'date': data.date,
    'customerid': data.customerId,
    'customername': data.customerName,
    'totalamount': data.totalAmount,
    'status': data.status,
    'notes': data.notes || '',
    'billingaddress': data.billingAddress || '',
    'billingphone': data.billingPhone || '',
    'billingemail': data.billingEmail || '',
    'shippingname': data.shippingName || '',
    'shippingaddress': data.shippingAddress || '',
    'shippingphone': data.shippingPhone || '',
    'deliveryfee': data.deliveryFee || 0,
    'isfreedelivery': data.isFreeDelivery ? true : false
  };

  Object.keys(mapping).forEach(key => {
    const colIdx = idx(key);
    if (colIdx !== -1 && mapping[key] !== undefined) {
      targetRow[colIdx] = mapping[key];
    }
  });

  docSheet.getRange(rowIndex, 1, 1, targetRow.length).setValues([targetRow]);

  // Sync Line Items (delete existing and insert new batch)
  const itemData = itemSheet.getDataRange().getValues();
  for (let i = itemData.length - 1; i >= 1; i--) {
    if (itemData[i][1] === docId) {
      itemSheet.deleteRow(i + 1);
    }
  }

  if (data.items && data.items.length > 0) {
    const newItems = data.items.map(item => [
      item.id || ('ITEM-' + Math.random().toString(36).substr(2, 9)),
      docId,
      item.description,
      item.quantity,
      item.unitPrice,
      item.amount
    ]);
    itemSheet.getRange(itemSheet.getLastRow() + 1, 1, newItems.length, newItems[0].length).setValues(newItems);
  }

  if (data.syncToMaster && data.customerId) {
    updateCustomer({
      id: data.customerId,
      name: data.customerName,
      billingAddress: data.billingAddress,
      billingPhone: data.billingPhone,
      billingEmail: data.billingEmail,
      shippingName: data.shippingName,
      shippingAddress: data.shippingAddress,
      shippingPhone: data.shippingPhone
    });
  }

  return response({ success: true, docId: docId, docNumber: data.docNumber });
}

function deleteDocument(docId) {
  if (!docId) return response({ success: false, error: 'Document ID is required' });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTS);
  const itemSheet = ss.getSheetByName(SHEETS.LINE_ITEMS);

  const docData = docSheet.getDataRange().getValues();
  let docRowIndex = -1;
  for (let i = 1; i < docData.length; i++) {
    if (docData[i][0] === docId) {
      docRowIndex = i + 1;
      break;
    }
  }

  if (docRowIndex === -1) return response({ success: false, error: 'Document not found' });

  docSheet.deleteRow(docRowIndex);

  // Delete line items
  const itemData = itemSheet.getDataRange().getValues();
  for (let i = itemData.length - 1; i >= 1; i--) {
    if (itemData[i][1] === docId) {
      itemSheet.deleteRow(i + 1);
    }
  }

  return response({ success: true });
}

function recoverDocument(docId) {
  // Soft-recovery handler if document is marked inactive
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTS);
  const docData = docSheet.getDataRange().getValues();

  for (let i = 1; i < docData.length; i++) {
    if (docData[i][0] === docId) {
      docSheet.getRange(i + 1, 8).setValue('DRAFT'); // Status column
      return response({ success: true });
    }
  }
  return response({ success: false, error: 'Document not found' });
}

function getItemSuggestions() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.LINE_ITEMS);
  if (!sheet) return response({ success: true, data: [] });

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return response({ success: true, data: [] });

  data.shift();
  const deliveryKeywords = ['delivery', 'delivery fee', 'free delivery', 'shipping', 'shipping fee'];
  const itemMap = new Map();

  data.forEach(row => {
    if (!row || row.length < 5) return;
    const description = row[2];
    const unitPrice = row[4];

    if (!description || String(description).trim() === '') return;
    const lower = String(description).toLowerCase().trim();
    if (deliveryKeywords.some(keyword => lower.includes(keyword))) return;

    if (!itemMap.has(description)) {
      itemMap.set(description, {
        description: String(description).trim(),
        price: unitPrice && !isNaN(unitPrice) ? Number(unitPrice) : 0
      });
    }
  });

  return response({ success: true, data: Array.from(itemMap.values()) });
}

function generateDocNumber(type) {
  const result = getNextDocNumberInternal();
  return result.docNumber;
}

function getNextDocNumber() {
  const result = getNextDocNumberInternal();
  return response({ success: true, docNumber: result.docNumber });
}

function getNextDocNumberInternal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTS);
  const data = docSheet.getDataRange().getValues();

  const now = new Date();
  const year = now.getFullYear().toString().substr(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `${year}${month}-`;

  let maxCounter = 0;

  if (data.length > 1) {
    const headers = data[0].map(h => h.toString().trim().toLowerCase());
    const docNumIdx = headers.indexOf('docnumber');
    const statusIdx = headers.indexOf('status');

    if (docNumIdx !== -1) {
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (statusIdx !== -1 && row[statusIdx] === 'INACTIVE') continue;
        const docNum = String(row[docNumIdx] || '');
        if (docNum.startsWith(prefix)) {
          const parts = docNum.split('-');
          if (parts.length >= 2) {
            const num = parseInt(parts[1], 10);
            if (!isNaN(num) && num > maxCounter) {
              maxCounter = num;
            }
          }
        }
      }
    }
  }

  const nextCounter = maxCounter + 1;
  const paddedCount = nextCounter.toString().padStart(3, '0');
  const docNumber = `${prefix}${paddedCount}`;

  return {
    docNumber: docNumber,
    counter: nextCounter,
    monthKey: `${year}${month}`
  };
}


function clearAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  [SHEETS.CUSTOMERS, SHEETS.DOCUMENTS, SHEETS.LINE_ITEMS].forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
  });
  return response({ success: true, message: 'All data cleared successfully' });
}

function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
