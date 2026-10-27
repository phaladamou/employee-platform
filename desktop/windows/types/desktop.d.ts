interface EmployeeDesktopInfo {
  platform: string;
  electron: string;
  node: string;
}

interface Window {
  employeeDesktop?: EmployeeDesktopInfo;
}
