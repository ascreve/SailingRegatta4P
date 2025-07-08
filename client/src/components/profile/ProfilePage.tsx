import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, LogOut } from "lucide-react";
import { useAuth } from "@/lib/stores/useAuth";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Handle logout
  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading user profile...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Fixed top navigation bar */}
      <div className="container mx-auto p-4 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Game
        </Button>
        <Button variant="destructive" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </div>
      
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto py-4 px-4 max-w-4xl pb-24">
          <Card className="mb-8">
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user.profilePicture || undefined} alt={user.username} />
                  <AvatarFallback className="text-lg">{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-2xl">{user.username}</CardTitle>
                  <CardDescription>Member since {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</CardDescription>
                </div>
              </div>
              <Button asChild>
                <Link to="/profile/edit">
                  <Edit className="mr-2 h-4 w-4" /> Edit Profile
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {user.bio && (
                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground mb-1">About Me</h3>
                    <p>{user.bio}</p>
                  </div>
                )}
                {user.personalUrl && (
                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground mb-1">Personal Link</h3>
                    <a 
                      href={user.personalUrl.startsWith('http') ? user.personalUrl : `https://${user.personalUrl}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {user.personalUrl}
                    </a>
                  </div>
                )}
                
                {/* Boat Names Section */}
                <div className="mt-6">
                  <h3 className="font-medium text-base mb-3">Your Boat Names</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border rounded-md p-3">
                      <span className="text-orange-400 font-medium">Boat 1:</span> 
                      <span className="ml-2">{user.boat1Name || "Unnamed"}</span>
                    </div>
                    <div className="border rounded-md p-3">
                      <span className="text-blue-400 font-medium">Boat 2:</span> 
                      <span className="ml-2">{user.boat2Name || "Unnamed"}</span>
                    </div>
                    <div className="border rounded-md p-3">
                      <span className="text-green-400 font-medium">Boat 3:</span> 
                      <span className="ml-2">{user.boat3Name || "Unnamed"}</span>
                    </div>
                    <div className="border rounded-md p-3">
                      <span className="text-purple-400 font-medium">Boat 4:</span> 
                      <span className="ml-2">{user.boat4Name || "Unnamed"}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    Edit your profile to customize boat names that will appear during races.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
