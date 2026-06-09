/**
 * Google Apps Script to handle POST requests from the Chrome Extension
 * 1. Create a new Google Sheet.
 * 2. Extensions > Apps Script.
 * 3. Paste this code.
 * 4. Set SECRET_TOKEN below and enter the same value in the Extension later.
 * 5. Deploy > New Deployment > Web App.
 * 6. Set 'Execute as: Me' and 'Who has access: Anyone'.
 * 7. Copy the Web App URL and paste it into the Extension.
 */

var SECRET_TOKEN = "";

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (!SECRET_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "SECRET_TOKEN is not configured" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.token !== SECRET_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid token" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "ping" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet;

    // 1. Get or Create the target sheet
    if (data.sheetName) {
      sheet = ss.getSheetByName(data.sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(data.sheetName);
      }
    } else {
      sheet = ss.getActiveSheet();
    }
    
    var existingHeaders = [];
    var lastCol = sheet.getLastColumn();
    var lastRow = sheet.getLastRow();

    // 2. Get incoming headers (from data.headers or keys)
    var incomingHeaders = data.headers || Object.keys(data).filter(function(k) {
      return !["sheetName", "headers", "token"].includes(k);
    });

    if (lastRow === 0) {
      // New sheet: Write all incoming headers as the first row
      existingHeaders = incomingHeaders;
      sheet.appendRow(existingHeaders);
    } else {
      // Existing sheet: Read current headers from row 1
      existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      
      // Find headers that are in 'incoming' but not in 'existing'
      var missingHeaders = incomingHeaders.filter(function(h) {
        return existingHeaders.indexOf(h) === -1;
      });
      
      if (missingHeaders.length > 0) {
        // Append missing headers to the end of row 1
        sheet.getRange(1, lastCol + 1, 1, missingHeaders.length).setValues([missingHeaders]);
        // Update local existingHeaders list to include new ones
        existingHeaders = existingHeaders.concat(missingHeaders);
      }
    }
    
    // 3. Map data to the (potentially updated) existingHeaders
    var row = existingHeaders.map(function(header) {
      var val = data[header];
      if (val === undefined || val === null) return "";
      if (typeof val === 'object') return JSON.stringify(val);
      return val;
    });
    
    sheet.appendRow(row);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      sheet: sheet.getName(),
      addedColumns: missingHeaders ? missingHeaders.length : 0 
    })).setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
