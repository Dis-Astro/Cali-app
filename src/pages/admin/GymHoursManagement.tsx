import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Clock, Loader2, Save } from "lucide-react";

interface GymHour {
  id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  note: string | null;
}

const dayNames = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

const GymHoursManagement = () => {
  const { toast } = useToast();
  const [hours, setHours] = useState<GymHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchHours();
  }, []);

  const fetchHours = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("gym_hours")
      .select("*")
      .order("day_of_week");

    if (error) {
      toast({ title: "Errore", description: "Impossibile caricare gli orari", variant: "destructive" });
    } else if (data && data.length > 0) {
      setHours(data);
    } else {
      // Initialize default hours if none exist
      const defaultHours: Omit<GymHour, 'id'>[] = Array.from({ length: 7 }, (_, i) => ({
        day_of_week: i,
        open_time: "08:00",
        close_time: "22:00",
        is_closed: i === 6, // Sunday closed by default
        note: null
      }));

      const { data: insertedData, error: insertError } = await supabase
        .from("gym_hours")
        .insert(defaultHours)
        .select();

      if (insertError) {
        toast({ title: "Errore", description: "Impossibile inizializzare gli orari", variant: "destructive" });
      } else if (insertedData) {
        setHours(insertedData);
      }
    }
    setLoading(false);
  };

  const updateHour = (index: number, field: keyof GymHour, value: any) => {
    const updated = [...hours];
    updated[index] = { ...updated[index], [field]: value };
    setHours(updated);
  };

  const saveAll = async () => {
    setSaving(true);
    
    for (const hour of hours) {
      const { error } = await supabase
        .from("gym_hours")
        .update({
          open_time: hour.open_time,
          close_time: hour.close_time,
          is_closed: hour.is_closed,
          note: hour.note
        })
        .eq("id", hour.id);

      if (error) {
        toast({ title: "Errore", description: `Errore nell'aggiornamento di ${dayNames[hour.day_of_week]}`, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    toast({ title: "Successo", description: "Orari salvati correttamente" });
    setSaving(false);
  };

  return (
    <AdminLayout title="ORARI PALESTRA" icon={<Clock className="w-6 h-6" />}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-display tracking-wider">Orari di Apertura</CardTitle>
            <CardDescription>Configura gli orari di apertura della palestra</CardDescription>
          </div>
          <Button onClick={saveAll} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salva Tutto
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {hours.map((hour, index) => (
                <div
                  key={hour.id}
                  className={`grid grid-cols-1 md:grid-cols-5 gap-4 items-center p-4 rounded-lg border ${
                    hour.is_closed ? "bg-muted/50 border-muted" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-24 font-display tracking-wider">
                      {dayNames[hour.day_of_week]}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!hour.is_closed}
                        onCheckedChange={(checked) => updateHour(index, "is_closed", !checked)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {hour.is_closed ? "Chiuso" : "Aperto"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Apertura</Label>
                    <Input
                      type="time"
                      value={hour.open_time}
                      onChange={(e) => updateHour(index, "open_time", e.target.value)}
                      disabled={hour.is_closed}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Chiusura</Label>
                    <Input
                      type="time"
                      value={hour.close_time}
                      onChange={(e) => updateHour(index, "close_time", e.target.value)}
                      disabled={hour.is_closed}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs">Note</Label>
                    <Input
                      placeholder="Es. Orario ridotto"
                      value={hour.note || ""}
                      onChange={(e) => updateHour(index, "note", e.target.value || null)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default GymHoursManagement;
