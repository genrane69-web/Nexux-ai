/**
 * ====================================================================
 * 🚀 NEXUS CORE AI - Backend Script (Code.gs)
 * ====================================================================
 * ไฟล์หลังบ้านสำหรับบริหารจัดการ Web App, ค้นหาข้อมูล และเชื่อมต่อหน่วยความจำ Google Sheets
 */

// --------------------------------------------------------------------
// 1. ฟังก์ชันเปิดหน้าเว็บแอป (Web App Handler)
// --------------------------------------------------------------------
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Nexus Core AI - ศูนย์กลางผู้ช่วยอัจฉริยะ')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// --------------------------------------------------------------------
// 2. ฟังก์ชันค้นหาหรือสร้างฐานข้อมูล Google Sheets อัตโนมัติ
// --------------------------------------------------------------------
function getOrCreateMemorySheet() {
  var fileName = "Nexus_Core_Memory_DB"; // ชื่อไฟล์ Google Sheets ที่ใช้เก็บความจำ
  
  try {
    // ค้นหาไฟล์ใน Google Drive
    var files = DriveApp.getFilesByName(fileName);
    
    if (files.hasNext()) {
      // กรณี 1: พบไฟล์เดิมอยู่แล้ว ให้เปิดใช้งานแผ่นงานแรกทันที
      var existingFile = files.next();
      return SpreadsheetApp.open(existingFile).getActiveSheet();
    } else {
      // กรณี 2: ยังไม่มีไฟล์ ให้สร้าง Google Sheets ใหม่ขึ้นมาบน Google Drive
      var newSpreadsheet = SpreadsheetApp.create(fileName);
      var sheet = newSpreadsheet.getActiveSheet();
      
      // กำหนดหัวตาราง (Headers)
      var headers = ["วัน-เวลาที่บันทึก", "โหมดผู้เชี่ยวชาญ", "เรื่อง/คำสั่ง", "โน้ตบันทึกเพิ่มเติม"];
      sheet.appendRow(headers);
      
      // ตกแต่งหัวตารางให้อ่านง่าย (ตัวหนา / พื้นหลังสีเข้ม / ข้อความสีขาว)
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold")
                 .setBackground("#1f2937")
                 .setFontColor("#ffffff");
                 
      // ตรึงแถวหัวตารางไว้ไม่ให้เลื่อนหาย
      sheet.setFrozenRows(1);
      
      return sheet;
    }
  } catch (error) {
    throw new Error("ไม่สามารถเข้าถึงหรือสร้าง Google Sheets ได้: " + error.message);
  }
}

// --------------------------------------------------------------------
// 3. ฟังก์ชันค้นหาข้อมูลผ่าน Google (ปรับแต่งตามโหมดผู้เชี่ยวชาญ)
// --------------------------------------------------------------------
function searchData(task, expertRole) {
  try {
    if (!task) {
      return { success: false, message: "กรุณาระบุเรื่องที่ต้องการค้นหา" };
    }
    
    var query = "";
    var roleName = expertRole || "ผู้เชี่ยวชาญทั่วไป";

    // ปรับแต่งคีย์เวิร์ดในการค้นหา Google ตามโหมดผู้เชี่ยวชาญที่ตั้งค่าไว้
    if (roleName !== "ผู้เชี่ยวชาญทั่วไป") {
      query = task + " " + roleName + " ข้อมูลเชิงลึก เอกสารอ้างอิง";
    } else {
      query = task;
    }

    // สร้าง URL สำหรับไปค้นหาบน Google
    var searchUrl = "https://www.google.com/search?q=" + encodeURIComponent(query);
    
    return {
      success: true,
      task: task,
      expertRole: roleName,
      googleLink: searchUrl
    };
  } catch (error) {
    return {
      success: false,
      message: "เกิดข้อผิดพลาดในการสร้างลิงก์ค้นหา: " + error.message
    };
  }
}

// --------------------------------------------------------------------
// 4. ฟังก์ชันบันทึกข้อมูลลงใน Google Sheets
// --------------------------------------------------------------------
function saveToSheet(task, note, expertRole) {
  try {
    if (!task) {
      return "เกิดข้อผิดพลาด: ไม่พบหัวข้อเรื่องที่จะบันทึก";
    }

    // ดึงแผ่นงาน (ถ้ายังไม่มีไฟล์ มันจะสร้างไฟล์ให้เองอัตโนมัติ)
    var sheet = getOrCreateMemorySheet();
    
    // ดึงวัน-เวลาปัจจุบันในประเทศไทย (GMT+7)
    var timeStamp = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm:ss");
    var roleName = expertRole || "ผู้เชี่ยวชาญทั่วไป";
    var noteText = note || "-";

    // เพิ่มแถวข้อมูลใหม่ลงในตาราง
    sheet.appendRow([timeStamp, roleName, task, noteText]);
    
    return "บันทึกความจำในโหมด [" + roleName + "] ลง Google Sheets เรียบร้อยแล้ว!";
  } catch (error) {
    return "เกิดข้อผิดพลาดในการบันทึก: " + error.message;
  }
}
