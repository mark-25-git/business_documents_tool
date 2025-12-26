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
    s.appendRow(['DocID', 'DocNumber', 'Type', 'Date', 'CustomerID', 'CustomerName', 'TotalAmount', 'Status', 'Notes', 'CreatedAt']);
    s.setFrozenRows(1);
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
    s.appendRow(['CustomerID', 'Name', 'Phone', 'Address', 'Email', 'CreatedAt']);
    s.setFrozenRows(1);
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
  const headers = data.shift();
  
  const customers = data.map(row => ({
    id: row[0],
    name: row[1],
    phone: row[2],
    address: row[3],
    email: row[4],
    createdAt: row[5]
  }));
  
  return response({ success: true, data: customers });
}

function createCustomer(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CUSTOMERS);
  const id = 'CUST-' + new Date().getTime();
  
  sheet.appendRow([
    id,
    data.name,
    data.phone,
    data.address,
    data.email,
    new Date().toISOString()
  ]);
  
  return response({ success: true, id: id });
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
    new Date().toISOString()
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
  const headers = data.shift();
  
  const docs = data.map(row => ({
    id: row[0],
    docNumber: row[1],
    type: row[2],
    date: row[3],
    customerId: row[4],
    customerName: row[5],
    totalAmount: row[6],
    status: row[7]
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
   
   const doc = {
     id: docRow[0],
     docNumber: docRow[1],
     type: docRow[2],
     date: docRow[3],
     customerId: docRow[4],
     customerName: docRow[5],
     totalAmount: docRow[6],
     status: docRow[7],
     notes: docRow[8]
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



