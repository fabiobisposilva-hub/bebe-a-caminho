-- BeBê a CaMinHo – versão 3: anexos de exames em PDF (até 10 MB) além de fotos
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
       file_size_limit = 10485760
 where id = 'fotos';
