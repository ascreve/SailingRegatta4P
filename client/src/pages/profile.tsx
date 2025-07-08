import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/stores/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { UpdateProfile } from "@shared/schema";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Upload, ArrowLeft } from "lucide-react";

export default function ProfilePage() {
  const { user, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Form validation schema
  const formSchema = z.object({
    bio: z.string().max(300, "Bio must be less than 300 characters").optional(),
    profilePicture: z.string().optional(),
    personalUrl: z.string().url("Please enter a valid URL").optional(),
  });

  // Initialize form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bio: user?.bio || "",
      profilePicture: user?.profilePicture || "",
      personalUrl: user?.personalUrl || "",
    },
  });

  // Update form values when user data is loaded
  useEffect(() => {
    if (user) {
      form.reset({
        bio: user.bio || "",
        profilePicture: user.profilePicture || "",
        personalUrl: user.personalUrl || "",
      });
    }
  }, [user, form]);

  // Form submission handler
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Use the updateProfile function from useAuth
      await useAuth.getState().updateProfile(
        user.id,
        values as UpdateProfile
      );
      
      toast.success("Profile updated successfully!");
      setIsLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      setError(message);
      toast.error(message);
      setIsLoading(false);
    }
  };

  if (!isAuthenticated || !user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container max-w-4xl py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Profile</h1>
        <Button 
          variant="outline" 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Game
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Username</h3>
              <p className="text-lg font-semibold">{user.username}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Email</h3>
              <p className="text-lg">{user.email}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Member Since</h3>
              <p className="text-lg">{new Date(user.created_at || Date.now()).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>
        
        {/* Edit Profile Form */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
            <CardDescription>Update your profile information</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tell us about yourself" 
                          className="resize-none" 
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="profilePicture"
                  render={({ field }) => {
                    // Handle file upload
                    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64String = reader.result as string;
                          setImagePreview(base64String);
                          field.onChange(base64String); // Update form field with base64 data
                        };
                        reader.readAsDataURL(file);
                      }
                    };
                    
                    return (
                      <FormItem>
                        <FormLabel>Profile Picture</FormLabel>
                        <div className="flex flex-col items-center space-y-4">
                          {/* Current image preview or placeholder */}
                          <div 
                            className="w-40 h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-full flex flex-col items-center justify-center overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer hover:border-primary hover:shadow-md group relative transition-all"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {imagePreview || field.value ? (
                              <>
                                <img 
                                  src={imagePreview || field.value || ''} 
                                  alt="Profile preview" 
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Upload className="h-10 w-10 text-white" />
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center p-4">
                                <Upload className="h-10 w-10 text-gray-400 mb-2" />
                                <p className="text-gray-500 dark:text-gray-400 text-xs text-center">
                                  Click to upload profile picture
                                </p>
                              </div>
                            )}
                          </div>
                          
                          {/* Upload button */}
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => fileInputRef.current?.click()}
                            className="mt-2"
                          >
                            <Upload className="mr-2 h-4 w-4" /> Upload Picture
                          </Button>
                          
                          {/* Hidden file input */}
                          <input 
                            type="file" 
                            ref={fileInputRef}
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleImageUpload} 
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="personalUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Personal Website</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://yourwebsite.com" 
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="mt-4" disabled={isLoading}>
                  {isLoading ? "Updating..." : "Update Profile"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        {/* Game Statistics Card (placeholder) */}
        <Card className="md:col-span-3 mt-4">
          <CardHeader>
            <CardTitle>Game Statistics</CardTitle>
            <CardDescription>Your sailing race performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col items-center p-4 bg-muted rounded-lg">
                <span className="text-3xl font-bold">0</span>
                <span className="text-sm text-muted-foreground">Races Completed</span>
              </div>
              <div className="flex flex-col items-center p-4 bg-muted rounded-lg">
                <span className="text-3xl font-bold">0</span>
                <span className="text-sm text-muted-foreground">Race Wins</span>
              </div>
              <div className="flex flex-col items-center p-4 bg-muted rounded-lg">
                <span className="text-3xl font-bold">0</span>
                <span className="text-sm text-muted-foreground">Average Finish Position</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}