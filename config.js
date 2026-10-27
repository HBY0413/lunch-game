// 資料庫連線設定。anon key 是公開金鑰，放在網頁上是安全的（資料由資料庫的權限規則保護）。
// 絕對不要把 service_role 金鑰放在這裡。
window.LUNCH_CONFIG = {
  supabaseUrl: 'https://hwlexuuszfigpizwicyj.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3bGV4dXVzemZpZ3BpendpY3lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMTkwMDYsImV4cCI6MjEwODY5NTAwNn0.PVs9LT0R7gZgNcaNYZTS-wTeiILElFS8s1k0MamYz_Y'
};
