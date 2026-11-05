import { DepartmentView } from "@/components/engineering/department-view";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DepartmentView departmentId={decodeURIComponent(id)} />;
}
