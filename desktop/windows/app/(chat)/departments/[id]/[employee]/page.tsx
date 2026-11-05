import { EmployeeWorkspaceView } from "@/components/engineering/employee-workspace";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; employee: string }>;
}) {
  const { id, employee } = await params;
  return (
    <EmployeeWorkspaceView
      departmentId={decodeURIComponent(id)}
      employeeSlug={decodeURIComponent(employee)}
      sessionId={null}
    />
  );
}
