import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, X, Upload } from "lucide-react";

interface ContactFormProps {
  className?: string;
}

export const ContactForm = ({ className = "" }: ContactFormProps) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MIN_PHOTOS = 0;
  const MAX_PHOTOS = 6;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else {
      // Validate Indian phone number (10 digits)
      const phoneDigits = formData.phone.replace(/\D/g, "");
      if (phoneDigits.length !== 10) {
        newErrors.phone = "Please enter a valid 10-digit Indian mobile number";
      }
    }
    
    if (!formData.subject.trim()) {
      newErrors.subject = "Subject is required";
    }
    
    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }
    
    if (photos.length < MIN_PHOTOS || photos.length > MAX_PHOTOS) {
      newErrors.photos = `Please upload between ${MIN_PHOTOS} and ${MAX_PHOTOS} photos`;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkIfBanned = async (email: string, phone: string) => {
    // Normalize phone number to match the format in the database (+91XXXXXXXXXX)
    const phoneDigits = phone.replace(/\D/g, "");
    let normalizedPhone = null;
    
    if (phoneDigits.length === 10) {
      normalizedPhone = `+91${phoneDigits}`;
    } else if (phoneDigits.length === 12 && phoneDigits.startsWith('91')) {
      normalizedPhone = `+${phoneDigits}`;
    } else if (phoneDigits.length === 13 && phoneDigits.startsWith('91')) {
      normalizedPhone = `+${phoneDigits}`;
    }
    
    // Build the query to check if user is banned
    let query = supabase
      .from("banned_users")
      .select("*")
      .eq("is_active", true)
      .limit(1);
    
    // Add conditions for email and/or phone if they exist
    if (email && normalizedPhone) {
      // Check both email and phone
      query = query.or(`email.eq.${email},phone.eq.${normalizedPhone}`);
    } else if (email) {
      // Check only email
      query = query.eq("email", email);
    } else if (normalizedPhone) {
      // Check only phone
      query = query.eq("phone", normalizedPhone);
    } else {
      // No valid identifiers to check
      return false;
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Error checking banned status:", error);
      return false;
    }
    
    return data && data.length > 0;
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    const totalFiles = photos.length + newFiles.length;

    if (totalFiles > MAX_PHOTOS) {
      toast.error(`You can upload a maximum of ${MAX_PHOTOS} photos`);
      return;
    }

    // Validate file types
    const validFiles = newFiles.filter(file => 
      file.type === 'image/jpeg' || 
      file.type === 'image/png' || 
      file.type === 'image/webp'
    );

    if (validFiles.length !== newFiles.length) {
      toast.error('Only JPEG, PNG, and WebP images are allowed');
      return;
    }

    // Validate file sizes (5MB max)
    const oversizedFiles = newFiles.filter(file => file.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error('Each image must be less than 5MB');
      return;
    }

    setPhotos(prev => [...prev, ...newFiles]);
    
    // Create previews
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setPhotoPreviews(prev => [...prev, ...newPreviews]);

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async () => {
    const photoUrls: string[] = [];
    
    for (const photo of photos) {
      const fileExt = photo.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('contact-photos')
        .upload(fileName, photo);
        
      if (uploadError) {
        throw uploadError;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('contact-photos')
        .getPublicUrl(fileName);
        
      photoUrls.push(publicUrl);
    }
    
    return photoUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Check if user is banned
      const isBanned = await checkIfBanned(formData.email, formData.phone);
      
      if (isBanned) {
        toast.error("You are not allowed to submit this form");
        setIsSubmitting(false);
        return;
      }
      
      // Upload photos if any
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        photoUrls = await uploadPhotos();
      }
      
      // Normalize phone number for storage
      const phoneDigits = formData.phone.replace(/\D/g, "");
      let normalizedPhone = formData.phone;
      
      if (phoneDigits.length === 10) {
        normalizedPhone = `+91${phoneDigits}`;
      } else if (phoneDigits.length === 12 && phoneDigits.startsWith('91')) {
        normalizedPhone = `+${phoneDigits}`;
      } else if (phoneDigits.length === 13 && phoneDigits.startsWith('91')) {
        normalizedPhone = `+${phoneDigits}`;
      }
      
      // Submit form data
      const { error } = await supabase.from("contact_submissions").insert([
        {
          name: formData.name,
          email: formData.email,
          phone: normalizedPhone,
          subject: formData.subject,
          description: formData.description,
          photos: photoUrls,
          is_banned: isBanned, // This should always be false since we're preventing banned users from submitting
        },
      ]);
      
      if (error) throw error;
      
      toast.success("Your message has been sent successfully!");
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        description: "",
      });
      setPhotos([]);
      setPhotoPreviews([]);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Failed to send your message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`bg-card rounded-xl border border-border/50 p-6 ${className}`}>
      <h3 className="font-display text-xl font-bold mb-6">Contact Support</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter your full name"
            className={errors.name ? "border-destructive" : ""}
          />
          {errors.name && <p className="text-destructive text-sm mt-1">{errors.name}</p>}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your.email@example.com"
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
          </div>
          
          <div>
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="e.g., 9876543210"
              className={errors.phone ? "border-destructive" : ""}
            />
            {errors.phone && <p className="text-destructive text-sm mt-1">{errors.phone}</p>}
          </div>
        </div>
        
        <div>
          <Label htmlFor="subject">Subject *</Label>
          <Input
            id="subject"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder="Brief subject of your inquiry"
            className={errors.subject ? "border-destructive" : ""}
          />
          {errors.subject && <p className="text-destructive text-sm mt-1">{errors.subject}</p>}
        </div>
        
        <div>
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Please provide detailed information about your inquiry"
            rows={4}
            className={errors.description ? "border-destructive" : ""}
          />
          {errors.description && <p className="text-destructive text-sm mt-1">{errors.description}</p>}
        </div>
        
        {/* Photo Upload Section */}
        <div>
          <Label>Photos (Optional, up to 6)</Label>
          <div className="mt-2 space-y-4">
            {/* Preview uploaded photos */}
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photoPreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img 
                      src={preview} 
                      alt={`Preview ${index + 1}`} 
                      className="w-full h-24 object-cover rounded-md border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute -top-2 -right-2 bg-destructive rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Upload button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handlePhotoChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={photos.length >= MAX_PHOTOS}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                {photos.length > 0 
                  ? `Add Photos (${photos.length}/${MAX_PHOTOS})` 
                  : 'Upload Photos'}
              </Button>
              <p className="text-sm text-muted-foreground mt-1">
                Upload up to {MAX_PHOTOS} photos (JPEG, PNG, or WebP, max 5MB each)
              </p>
              {errors.photos && <p className="text-destructive text-sm mt-1">{errors.photos}</p>}
            </div>
          </div>
        </div>
        
        <Button 
          type="submit" 
          variant="royal" 
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            "Send Message"
          )}
        </Button>
      </form>
    </div>
  );
};