import { EmployeeWorkspaceView } from "@/components/engineering/employee-workspace";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; employee: string; sessionId: string }>;
}) {
  const { id, employee, sessionId } = await params;
  return (
    <EmployeeWorkspaceView
      departmentId={decodeURIComponent(id)}
      employeeSlug={decodeURIComponent(employee)}
      sessionId={decodeURIComponent(sessionId)}
    />
  );
}
