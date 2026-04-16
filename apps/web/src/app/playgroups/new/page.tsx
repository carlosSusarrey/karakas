import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { NewPlaygroupForm } from "./new-playgroup-form";

export default async function NewPlaygroupPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return <NewPlaygroupForm username={user.username} />;
}
