import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateCommunityForm } from "@/components/create-community-form";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/session";

export default async function NewCommunityPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="max-w-md">
      <PageHeader
        title="New Community"
        description="Create a group to compare predictions with friends."
      />

      <div className="mt-8">
        <CreateCommunityForm />
      </div>

      <div className="mt-4">
        <Link
          href="/communities"
          className="text-caption-md text-muted-foreground underline"
        >
          Back to Communities
        </Link>
      </div>
    </div>
  );
}
