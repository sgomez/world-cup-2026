import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { getSession } from "@/lib/session";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = session.user as {
    name: string;
    email: string;
    image?: string | null;
  };

  return (
    <div className="max-w-[512px]">
      <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
        Edit Profile
      </h1>
      <p className="mt-1 text-caption-md text-muted-foreground">
        Update your display name and avatar.
      </p>

      <ProfileForm name={user.name} email={user.email} image={user.image} />
    </div>
  );
}
