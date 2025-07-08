import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Upload } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/stores/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function EditProfile() {
  const { user, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form validation schema - making all fields optional
  const formSchema = z.object({
    bio: z.string().max(280, "Bio must not exceed 280 characters").optional(),
    profilePicture: z.string().optional(),
    personalUrl: z.string().url("Must be a valid URL").or(z.string().length(0)).optional(),
    boat1Name: z.string().max(20, "Boat name must not exceed 20 characters").optional(),
    boat2Name: z.string().max(20, "Boat name must not exceed 20 characters").optional(),
    boat3Name: z.string().max(20, "Boat name must not exceed 20 characters").optional(),
    boat4Name: z.string().max(20, "Boat name must not exceed 20 characters").optional(),
  });

  // Initialize form with non-null defaults
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bio: user?.bio || "",
      profilePicture: user?.profilePicture || "",
      personalUrl: user?.personalUrl || "",
      boat1Name: user?.boat1Name || "",
      boat2Name: user?.boat2Name || "",
      boat3Name: user?.boat3Name || "",
      boat4Name: user?.boat4Name || "",
    },
  });

  // Form submission handler
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);
      await apiRequest("PATCH", `/api/users/${user?.id}/profile`, values);
      await checkAuth(); // Refresh user data
      toast.success("Profile updated successfully");
      navigate("/profile");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update profile";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="container mx-auto p-4 flex items-center">
        <Button variant="outline" size="sm" onClick={() => navigate("/profile")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Profile
        </Button>
      </div>
      
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto py-4 px-4 max-w-2xl pb-24">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Edit Your Profile</CardTitle>
              <CardDescription>Update your profile information</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Profile Picture */}
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
                          <FormDescription className="text-center mt-2">
                            Click to select a profile picture from your computer
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  {/* Bio */}
                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => {
                      const bioLength = field.value ? field.value.length : 0;
                      return (
                        <FormItem>
                          <FormLabel>Bio</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Tell us a bit about yourself" 
                              autoComplete="off"
                              inputMode="text"
                              {...field} 
                              className="resize-none"
                              maxLength={280}
                            />
                          </FormControl>
                          <FormDescription>
                            Max 280 characters ({280 - bioLength} remaining)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  {/* Personal URL */}
                  <FormField
                    control={form.control}
                    name="personalUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personal URL</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://yourdomain.com" 
                            type="url"
                            inputMode="url"
                            autoComplete="url"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Add a link to your website or social media
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Boat Names Section */}
                  <div className="mt-8 mb-4">
                    <h3 className="text-lg font-semibold">Boat Names</h3>
                    <p className="text-sm text-muted-foreground">Customize names for your boats in races</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="boat1Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <span className="text-orange-400">Boat 1</span> Name
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Orange Boat" 
                              inputMode="text"
                              autoComplete="off"
                              {...field} 
                              maxLength={20} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="boat2Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <span className="text-blue-400">Boat 2</span> Name
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Blue Boat" 
                              inputMode="text"
                              autoComplete="off"
                              {...field} 
                              maxLength={20} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="boat3Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <span className="text-green-400">Boat 3</span> Name
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Green Boat" 
                              inputMode="text"
                              autoComplete="off"
                              {...field} 
                              maxLength={20} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="boat4Name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <span className="text-purple-400">Boat 4</span> Name
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Purple Boat" 
                              inputMode="text"
                              autoComplete="off"
                              {...field} 
                              maxLength={20} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Saving..." : (
                        <>
                          <Save className="mr-2 h-4 w-4" /> Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}