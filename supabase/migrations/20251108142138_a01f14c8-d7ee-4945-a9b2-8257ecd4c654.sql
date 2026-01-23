-- Enable realtime for hostel tables for real-time dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.hostel_allocations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hostel_fees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hostel_maintenance_issues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trainees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trainers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fee_records;