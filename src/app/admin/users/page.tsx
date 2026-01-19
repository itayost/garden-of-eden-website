import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Pencil } from "lucide-react";
import type { Profile } from "@/types/database";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  // Verify admin role before showing user list
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    redirect("/login");
  }

  const { data: currentProfile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single()) as { data: { role: string } | null };

  if (currentProfile?.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: users, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch users:", error);
  }

  const typedUsers = users as Profile[] | null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("he-IL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "-";
    if (phone.startsWith("+972")) {
      return "0" + phone.slice(4);
    }
    return phone;
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-red-500">מנהל</Badge>;
      case "trainer":
        return <Badge className="bg-blue-500">מאמן</Badge>;
      default:
        return <Badge variant="secondary">מתאמן</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">ניהול משתמשים</h1>
        <p className="text-muted-foreground">
          צפייה וניהול של כל המשתמשים במערכת
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            רשימת משתמשים ({typedUsers?.length || 0})
          </CardTitle>
          <CardDescription>כל המשתמשים הרשומים במערכת</CardDescription>
        </CardHeader>
        <CardContent>
          {typedUsers && typedUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם</TableHead>
                    <TableHead>טלפון</TableHead>
                    <TableHead>תפקיד</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>תאריך הרשמה</TableHead>
                    <TableHead className="w-[80px]">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.full_name || "לא צוין"}
                      </TableCell>
                      <TableCell dir="ltr" className="text-right">
                        {formatPhone(user.phone)}
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        {user.is_active === true ? (
                          <Badge variant="outline" className="border-green-500 text-green-600">
                            פעיל
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-red-500 text-red-600">
                            לא פעיל
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(user.created_at)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/admin/users/${user.id}`}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">עריכת {user.full_name}</span>
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>אין משתמשים רשומים עדיין</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
