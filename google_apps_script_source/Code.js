/**
 * BACKEND CODE FOR GOOGLE SHEETS
 * Copy and paste this into your Google Apps Script editor (Extensions > Apps Script)
 */

const SHEETS = {
  DOCUMENTS: 'Documents',
  LINE_ITEMS: 'LineItems',
  CUSTOMERS: 'Customers',
  CONFIG: 'Config'
};

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Create Documents Sheet
  if (!ss.getSheetByName(SHEETS.DOCUMENTS)) {
    const s = ss.insertSheet(SHEETS.DOCUMENTS);
    s.appendRow(['DocID', 'DocNumber', 'Type', 'Date', 'CustomerID', 'CustomerName', 'TotalAmount', 'Status', 'Notes', 'CreatedAt', 'BillingAddress', 'BillingPhone', 'BillingEmail', 'ShippingName', 'ShippingAddress', 'ShippingPhone']);
    s.setFrozenRows(1);
  } else {
    // Check if new columns need to be added to existing sheet
    const s = ss.getSheetByName(SHEETS.DOCUMENTS);
    const headers = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
    const newHeaders = ['BillingAddress', 'BillingPhone', 'BillingEmail', 'ShippingName', 'ShippingAddress', 'ShippingPhone'];

    newHeaders.forEach(header => {
      if (headers.map(h => h.toLowerCase()).indexOf(header.toLowerCase()) === -1) {
        s.getRange(1, s.getLastColumn() + 1).setValue(header);
      }
    });
    // Record backend version
    const configSheet = ss.getSheetByName(SHEETS.CONFIG);
    if (configSheet) {
      configSheet.appendRow(['BackendVersion', '2.1.0']);
    }
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

  // Create Config Sheet
  if (!ss.getSheetByName(SHEETS.CONFIG)) {
    const s = ss.insertSheet(SHEETS.CONFIG);
    s.appendRow(['Key', 'Value']);
    s.appendRow(['LastDocMonth', '']);
    s.appendRow(['DocCounter', '0']);
  }
}

function doGet(e) {
  const action = e.parameter.action;

  if (action === 'getCustomers') {
    return getCustomers();
  } else if (action === 'getDocuments') {
    return getDocuments();
  } else if (action === 'getDocument') {
    return getDocument(e.parameter.id);
  } else if (action === 'getItemSuggestions') {
    return getItemSuggestions();
  }

  return response({ error: 'Invalid action' });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = e.parameter.action;

    if (action === 'createCustomer') {
      return createCustomer(data);
    } else if (action === 'updateCustomer') {
      return updateCustomer(data);
    } else if (action === 'createDocument') {
      return createDocument(data);
    } else if (action === 'deleteDocument') {
      return deleteDocument(data.id);
    }

    return response({ success: false, error: 'Invalid action' });
  } catch (err) {
    return response({ success: false, error: err.toString() });
  }
}

// --- Service Functions ---

function getCustomers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CUSTOMERS);
  const data = sheet.getDataRange().getValues();
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
  const headers = sheet.getDataRange().getValues()[0].map(h => h.toString().trim().toLowerCase());
  const idx = name => headers.indexOf(name.toLowerCase());

  const id = 'CUST-' + new Date().getTime();
  const row = new Array(headers.length).fill('');

  const mapping = {
    'id': id,
    'name': data.name,
    'phone': data.phone,
    'address': data.address,
    'email': data.email,
    'createdat': new Date().toISOString(),
    'billingaddress': data.billingAddress || data.address || '',
    'billingphone': data.billingPhone || data.phone || '',
    'billingemail': data.billingEmail || data.email || '',
    'shippingname': data.shippingName || data.name || '',
    'shippingaddress': data.shippingAddress || data.address || '',
    'shippingphone': data.shippingPhone || data.phone || ''
  };

  Object.keys(mapping).forEach(key => {
    const colIdx = idx(key);
    if (colIdx !== -1) {
      row[colIdx] = mapping[key];
    }
  });

  sheet.appendRow(row);
  return response({ success: true, id: id });
}

function updateCustomer(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CUSTOMERS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift().map(h => h.toString().trim().toLowerCase());
  const idx = name => headers.indexOf(name.toLowerCase());

  const customerId = data.id;
  let rowIndex = -1;
  const idColIdx = idx('customerid');

  if (idColIdx === -1) return response({ success: false, error: 'CustomerID column not found' });

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][idColIdx] === customerId) {
      rowIndex = i + 2; // +1 for offset, +1 for header
      break;
    }
  }

  if (rowIndex === -1) return response({ success: false, error: 'Customer not found' });

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
      sheet.getRange(rowIndex, colIdx + 1).setValue(updateMap[key]);
    }
  });

  return response({ success: true });
}

function migrateCustomersToDualAddress() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CUSTOMERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().trim().toLowerCase());
  const idx = name => headers.indexOf(name.toLowerCase());

  // Columns to populate if empty
  const bAddrIdx = idx('billingaddress');
  const bPhoneIdx = idx('billingphone');
  const sNameIdx = idx('shippingname');
  const sAddrIdx = idx('shippingaddress');
  const sPhoneIdx = idx('shippingphone');

  const nameIdx = idx('name');
  const phoneIdx = idx('phone');
  const addrIdx = idx('address');

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowIndex = i + 1;

    // Fill Billing Address from legacy Address if empty
    if (bAddrIdx !== -1 && !row[bAddrIdx] && addrIdx !== -1) {
      sheet.getRange(rowIndex, bAddrIdx + 1).setValue(row[addrIdx]);
    }
    // Fill Billing Phone from legacy Phone if empty
    if (bPhoneIdx !== -1 && !row[bPhoneIdx] && phoneIdx !== -1) {
      sheet.getRange(rowIndex, bPhoneIdx + 1).setValue(row[phoneIdx]);
    }
    // Fill Shipping Name from Name if empty
    if (sNameIdx !== -1 && !row[sNameIdx] && nameIdx !== -1) {
      sheet.getRange(rowIndex, sNameIdx + 1).setValue(row[nameIdx]);
    }
    // Fill Shipping Address from legacy Address if empty
    if (sAddrIdx !== -1 && !row[sAddrIdx] && addrIdx !== -1) {
      sheet.getRange(rowIndex, sAddrIdx + 1).setValue(row[addrIdx]);
    }
    // Fill Shipping Phone from legacy Phone if empty
    if (sPhoneIdx !== -1 && !row[sPhoneIdx] && phoneIdx !== -1) {
      sheet.getRange(rowIndex, sPhoneIdx + 1).setValue(row[phoneIdx]);
    }
  }

  return response({ success: true, message: 'Migration complete' });
}

function createDocument(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTS);
  const itemSheet = ss.getSheetByName(SHEETS.LINE_ITEMS);

  // Generate Doc Number
  const docNumber = generateDocNumber(data.type);
  const docId = 'DOC-' + new Date().getTime();

  // Save Header
  docSheet.appendRow([
    docId,
    docNumber,
    data.type,
    data.date,
    data.customerId,
    data.customerName,
    data.totalAmount,
    data.status,
    data.notes,
    new Date().toISOString(),
    data.billingAddress,
    data.billingPhone,
    data.billingEmail,
    data.shippingName,
    data.shippingAddress,
    data.shippingPhone
  ]);

  // Save Items
  const items = data.items.map(item => [
    'ITEM-' + Math.random().toString(36).substr(2, 9),
    docId,
    item.description,
    item.quantity,
    item.unitPrice,
    item.amount
  ]);

  if (items.length > 0) {
    itemSheet.getRange(itemSheet.getLastRow() + 1, 1, items.length, items[0].length).setValues(items);
  }

  return response({ success: true, docId: docId, docNumber: docNumber });
}

function getDocuments() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.DOCUMENTS);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift().map(h => h.toString().trim().toLowerCase());
  const idx = name => headers.indexOf(name.toLowerCase());

  const docs = data.map(row => ({
    id: row[idx('DocID')],
    docNumber: row[idx('DocNumber')],
    type: row[idx('Type')],
    date: row[idx('Date')],
    customerId: row[idx('CustomerID')],
    customerName: row[idx('CustomerName')],
    totalAmount: row[idx('TotalAmount')],
    status: row[idx('Status')]
  })).reverse(); // Newest first

  return response({ success: true, data: docs });
}

function getDocument(docId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTS);
  const itemSheet = ss.getSheetByName(SHEETS.LINE_ITEMS);

  // Find Doc
  const docData = docSheet.getDataRange().getValues();
  docData.shift();
  const docRow = docData.find(row => row[0] === docId);

  if (!docRow) return response({ error: 'Document not found' });

  const headersRow = docSheet.getRange(1, 1, 1, docSheet.getLastColumn()).getValues()[0];
  const headers = headersRow.map(h => h.toString().trim().toLowerCase());
  const idx = name => {
    const i = headers.indexOf(name.toLowerCase());
    if (i === -1) {
      console.error('Column NOT FOUND in headers: ' + name + '. Headers are: ' + JSON.stringify(headers));
    }
    return i;
  };

  const doc = {
    id: docRow[idx('DocID')],
    docNumber: docRow[idx('DocNumber')],
    type: docRow[idx('Type')],
    date: docRow[idx('Date')],
    customerId: docRow[idx('CustomerID')],
    customerName: docRow[idx('CustomerName')],
    totalAmount: docRow[idx('TotalAmount')],
    status: docRow[idx('Status')],
    notes: docRow[idx('Notes')],
    billingAddress: idx('BillingAddress') !== -1 ? (docRow[idx('BillingAddress')] || '') : '',
    billingPhone: idx('BillingPhone') !== -1 ? (docRow[idx('BillingPhone')] || '') : '',
    billingEmail: idx('BillingEmail') !== -1 ? (docRow[idx('BillingEmail')] || '') : '',
    shippingName: idx('ShippingName') !== -1 ? (docRow[idx('ShippingName')] || '') : '',
    shippingAddress: idx('ShippingAddress') !== -1 ? (docRow[idx('ShippingAddress')] || '') : '',
    shippingPhone: idx('ShippingPhone') !== -1 ? (docRow[idx('ShippingPhone')] || '') : ''
  };

  // Find Items
  const itemData = itemSheet.getDataRange().getValues();
  itemData.shift();
  const items = itemData
    .filter(row => row[1] === docId)
    .map(row => ({
      id: row[0],
      description: row[2],
      quantity: row[3],
      unitPrice: row[4],
      amount: row[5]
    }));

  return response({ success: true, data: { ...doc, items } });
}

function deleteDocument(docId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTS);
  const itemSheet = ss.getSheetByName(SHEETS.LINE_ITEMS);

  // Find and delete document row
  const docData = docSheet.getDataRange().getValues();
  let docRowIndex = -1;
  for (let i = 1; i < docData.length; i++) {
    if (docData[i][0] === docId) {
      docRowIndex = i + 1; // +1 because spreadsheet rows are 1-indexed
      break;
    }
  }

  if (docRowIndex === -1) {
    return response({ success: false, error: 'Document not found' });
  }

  // Delete document row
  docSheet.deleteRow(docRowIndex);

  // Find and delete all associated line items
  const itemData = itemSheet.getDataRange().getValues();
  const rowsToDelete = [];
  for (let i = itemData.length - 1; i >= 1; i--) {
    if (itemData[i][1] === docId) {
      rowsToDelete.push(i + 1); // +1 because spreadsheet rows are 1-indexed
    }
  }

  // Delete from bottom to top to maintain correct indices
  rowsToDelete.forEach(rowIndex => {
    itemSheet.deleteRow(rowIndex);
  });

  return response({ success: true });
}

/**
 * ONE-TIME MIGRATION SCRIPT
 * Run this once after updating Code.js to backfill addresses for existing documents.
 */
function migrateExistingDocuments() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const docSheet = ss.getSheetByName(SHEETS.DOCUMENTS);
  const custSheet = ss.getSheetByName(SHEETS.CUSTOMERS);

  const docData = docSheet.getDataRange().getValues();
  const headers = docData.shift();

  const custData = custSheet.getDataRange().getValues();
  custData.shift();
  const custMap = new Map(custData.map(row => [row[0], {
    name: row[1],
    phone: row[2],
    address: row[3],
    email: row[4]
  }]));

  const billingAddrIdx = headers.indexOf('BillingAddress');
  const billingPhoneIdx = headers.indexOf('BillingPhone');
  const billingEmailIdx = headers.indexOf('BillingEmail');
  const shippingNameIdx = headers.indexOf('ShippingName');
  const shippingAddrIdx = headers.indexOf('ShippingAddress');
  const shippingPhoneIdx = headers.indexOf('ShippingPhone');

  if (billingAddrIdx === -1) return "Error: Run setup() first to add columns.";

  docData.forEach((row, i) => {
    const customerId = row[4];
    const customer = custMap.get(customerId);

    if (customer) {
      const rowIndex = i + 2; // 1-indexed + header

      // Only fill if empty to avoid overwriting manually corrected data
      if (!row[billingAddrIdx]) docSheet.getRange(rowIndex, billingAddrIdx + 1).setValue(customer.address);
      if (!row[billingPhoneIdx]) docSheet.getRange(rowIndex, billingPhoneIdx + 1).setValue(customer.phone);
      if (!row[billingEmailIdx]) docSheet.getRange(rowIndex, billingEmailIdx + 1).setValue(customer.email);
      if (!row[shippingNameIdx]) docSheet.getRange(rowIndex, shippingNameIdx + 1).setValue(customer.name);
      if (!row[shippingAddrIdx]) docSheet.getRange(rowIndex, shippingAddrIdx + 1).setValue(customer.address);
      if (!row[shippingPhoneIdx]) docSheet.getRange(rowIndex, shippingPhoneIdx + 1).setValue(customer.phone);
    }
  });

  return "Migration completed successfully.";
}

// --- Helper Functions ---

function getItemSuggestions() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.LINE_ITEMS);
    if (!sheet) {
      return response({ success: false, error: 'LineItems sheet not found' });
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      // Only header row or empty sheet
      return response({ success: true, data: [] });
    }

    data.shift(); // Remove header row

    // Column structure: [ItemID, DocID, Description, Quantity, UnitPrice, Amount]
    // Index:             0       1      2            3         4          5
    // Get unique descriptions with their first price found, excluding delivery-related items
    const deliveryKeywords = ['delivery', 'delivery fee', 'free delivery', 'shipping', 'shipping fee'];

    // Map to store description -> price (first price found for each description)
    const itemMap = new Map();

    data.forEach(row => {
      if (!row || row.length < 5) return;

      const description = row[2]; // Column C
      const unitPrice = row[4];   // Column E (UnitPrice)

      // Filter out null, undefined, empty strings
      if (!description || (typeof description === 'string' && description.trim() === '')) return;

      const lower = String(description).toLowerCase().trim();
      // Exclude if contains delivery keywords
      if (deliveryKeywords.some(keyword => lower.includes(keyword))) return;

      // Store first price found for this description
      if (!itemMap.has(description)) {
        itemMap.set(description, {
          description: String(description).trim(),
          price: unitPrice && !isNaN(unitPrice) ? Number(unitPrice) : 0
        });
      }
    });

    // Convert map to array
    const items = Array.from(itemMap.values());

    return response({ success: true, data: items });
  } catch (error) {
    return response({ success: false, error: error.toString() });
  }
}

function generateDocNumber(type) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEETS.CONFIG);
  const data = configSheet.getDataRange().getValues();

  // Find current month/counter
  const now = new Date();
  const year = now.getFullYear().toString().substr(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const currentMonthKey = year + month;

  let lastDocMonth = data[1][1];
  let docCounter = parseInt(data[2][1]);

  if (lastDocMonth != currentMonthKey) {
    docCounter = 1;
    configSheet.getRange(2, 2).setValue(currentMonthKey);
  } else {
    docCounter++;
  }

  configSheet.getRange(3, 2).setValue(docCounter);

  const paddedCount = docCounter.toString().padStart(3, '0');
  return `${year}${month}-${paddedCount}`;
}

function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}



