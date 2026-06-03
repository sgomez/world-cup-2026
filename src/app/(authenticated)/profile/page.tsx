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
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-white">Edit Profile</h1>
      <p className="mt-1 text-sm text-slate-400">
        Update your display name and avatar.
      </p>

      <ProfileForm name={user.name} email={user.email} image={user.image} />
    </div>
  );
}
