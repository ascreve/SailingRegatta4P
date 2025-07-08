import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { useAuth } from "@/lib/stores/useAuth";

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeedbackDialog({ isOpen, onClose }: FeedbackDialogProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error("Please enter your feedback before submitting");
      return;
    }

    if (!user) {
      toast.error("You must be logged in to submit feedback");
      return;
    }

    setIsSubmitting(true);

    try {
      await apiRequest("POST", "/api/feedback", {
        username: user.username,
        email: user.email,
        message: message.trim(),
      });

      toast.success("Feedback submitted successfully! Thank you for your input.", {
        duration: 5000,
        icon: "✅",
      });

      setMessage("");
      onClose();
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border border-gray-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white text-lg font-semibold">
            Feedback
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-gray-300 text-sm">
            All feedback is reviewed by the GOAT Sailing team.
          </p>
          
          <Textarea
            placeholder="Please share bugs, feature requests, and anything else related to your experience..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[120px] bg-gray-800 border-gray-600 text-white placeholder-gray-400 resize-none focus:border-blue-500 focus:ring-blue-500"
            disabled={isSubmitting}
          />
          
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !message.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Sending feedback..." : "Send feedback"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}