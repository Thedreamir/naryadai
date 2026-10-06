-- Stage 5: deliver notification inserts over realtime for in-app push (sound+banner).
alter publication supabase_realtime add table notifications;
