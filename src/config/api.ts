// Update this to match your PHP backend's base URL.
// Examples:
//   Local XAMPP on same PC as emulator: 'http://10.0.2.2/NWSSU-Attendance_Tracker'
//   Physical device on same WiFi:       'http://192.168.1.X/NWSSU-Attendance_Tracker'
//   Live server:                        'https://yourdomain.com/NWSSU-Attendance_Tracker'
export const API_BASE_URL = 'http://192.168.1.42/NWSSU-Attendance_Tracker';

// Adjust these paths if your folder structure differs from api/students/...
export const ENDPOINTS = {
  studentsList: `${API_BASE_URL}/api/students/list.php`,
  studentsSearch: `${API_BASE_URL}/api/students/search.php`,
  studentsAdd: `${API_BASE_URL}/api/students/add.php`,
  studentsUpdate: `${API_BASE_URL}/api/students/update.php`,
  studentsUpload: `${API_BASE_URL}/api/students/upload.php`,
  departmentsList: `${API_BASE_URL}/api/departments/list.php`,
};