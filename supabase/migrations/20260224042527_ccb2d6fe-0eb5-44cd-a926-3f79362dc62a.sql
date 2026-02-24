
-- Update the seed function to include all symbols including F, G, U
CREATE OR REPLACE FUNCTION public.seed_symbol_points_for_organization(org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.symbol_points WHERE organization_id = org_id) THEN
    
    -- GCE A-Level
    INSERT INTO public.symbol_points (organization_id, exam_level, symbol, points, active) VALUES
    (org_id, 'GCE_A_LEVEL', 'A', 10, true),
    (org_id, 'GCE_A_LEVEL', 'B', 9, true),
    (org_id, 'GCE_A_LEVEL', 'C', 8, true),
    (org_id, 'GCE_A_LEVEL', 'D', 7, true),
    (org_id, 'GCE_A_LEVEL', 'E', 6, true),
    (org_id, 'GCE_A_LEVEL', 'U', 0, true);
    
    -- GCE AS Level
    INSERT INTO public.symbol_points (organization_id, exam_level, symbol, points, active) VALUES
    (org_id, 'GCE_AS', 'a', 7, true),
    (org_id, 'GCE_AS', 'b', 6, true),
    (org_id, 'GCE_AS', 'c', 5, true),
    (org_id, 'GCE_AS', 'd', 4, true),
    (org_id, 'GCE_AS', 'e', 3, true),
    (org_id, 'GCE_AS', 'u', 0, true);
    
    -- GCE O-Level
    INSERT INTO public.symbol_points (organization_id, exam_level, symbol, points, active) VALUES
    (org_id, 'GCE_O_LEVEL', 'A/1', 7, true),
    (org_id, 'GCE_O_LEVEL', 'B/2', 6, true),
    (org_id, 'GCE_O_LEVEL', 'C/3', 5, true),
    (org_id, 'GCE_O_LEVEL', 'D/4', 4, true),
    (org_id, 'GCE_O_LEVEL', 'E/5', 3, true),
    (org_id, 'GCE_O_LEVEL', 'F/6', 2, true),
    (org_id, 'GCE_O_LEVEL', 'G/7', 1, true),
    (org_id, 'GCE_O_LEVEL', 'U', 0, true);
    
    -- IB Higher Level (HL)
    INSERT INTO public.symbol_points (organization_id, exam_level, symbol, points, active) VALUES
    (org_id, 'IB_HL', '7', 9, true),
    (org_id, 'IB_HL', '6', 7, true),
    (org_id, 'IB_HL', '5', 6, true),
    (org_id, 'IB_HL', '4', 5, true),
    (org_id, 'IB_HL', '3', 4, true),
    (org_id, 'IB_HL', '2', 3, true),
    (org_id, 'IB_HL', '1', 2, true);
    
    -- IB Standard Level (SL)
    INSERT INTO public.symbol_points (organization_id, exam_level, symbol, points, active) VALUES
    (org_id, 'IB_SL', '7', 6, true),
    (org_id, 'IB_SL', '6', 5, true),
    (org_id, 'IB_SL', '5', 4, true),
    (org_id, 'IB_SL', '4', 3, true),
    (org_id, 'IB_SL', '3', 2, true),
    (org_id, 'IB_SL', '2', 1, true),
    (org_id, 'IB_SL', '1', 0, true);
    
    -- NSSC AS
    INSERT INTO public.symbol_points (organization_id, exam_level, symbol, points, active) VALUES
    (org_id, 'NSSC_AS', 'a', 6, true),
    (org_id, 'NSSC_AS', 'b', 5, true),
    (org_id, 'NSSC_AS', 'c', 4, true),
    (org_id, 'NSSC_AS', 'd', 3, true),
    (org_id, 'NSSC_AS', 'e', 2, true),
    (org_id, 'NSSC_AS', 'f', 1, true);
    
    -- NSSC Higher (NSSCH)
    INSERT INTO public.symbol_points (organization_id, exam_level, symbol, points, active) VALUES
    (org_id, 'NSSCH', '1', 7, true),
    (org_id, 'NSSCH', '2', 6, true),
    (org_id, 'NSSCH', '3', 5, true),
    (org_id, 'NSSCH', '4', 4, true),
    (org_id, 'NSSCH', '5', 3, true),
    (org_id, 'NSSCH', '6', 2, true),
    (org_id, 'NSSCH', '7', 1, true);
    
    -- NSSC Ordinary (NSSCO)
    INSERT INTO public.symbol_points (organization_id, exam_level, symbol, points, active) VALUES
    (org_id, 'NSSCO', 'A', 7, true),
    (org_id, 'NSSCO', 'B', 6, true),
    (org_id, 'NSSCO', 'C', 5, true),
    (org_id, 'NSSCO', 'D', 4, true),
    (org_id, 'NSSCO', 'E', 3, true),
    (org_id, 'NSSCO', 'F', 2, true),
    (org_id, 'NSSCO', 'G', 1, true);
    
    -- Cambridge HIGCSE
    INSERT INTO public.symbol_points (organization_id, exam_level, symbol, points, active) VALUES
    (org_id, 'HIGCSE', '1', 7, true),
    (org_id, 'HIGCSE', '2', 6, true),
    (org_id, 'HIGCSE', '3', 5, true),
    (org_id, 'HIGCSE', '4', 4, true),
    (org_id, 'HIGCSE', '5', 3, true),
    (org_id, 'HIGCSE', '6', 2, true),
    (org_id, 'HIGCSE', '7', 1, true);
    
    -- Cambridge IGCSE
    INSERT INTO public.symbol_points (organization_id, exam_level, symbol, points, active) VALUES
    (org_id, 'IGCSE', 'A*', 7, true),
    (org_id, 'IGCSE', 'A', 6, true),
    (org_id, 'IGCSE', 'B', 5, true),
    (org_id, 'IGCSE', 'C', 4, true),
    (org_id, 'IGCSE', 'D', 3, true),
    (org_id, 'IGCSE', 'E', 2, true),
    (org_id, 'IGCSE', 'F', 1, true),
    (org_id, 'IGCSE', 'G', 0, true),
    (org_id, 'IGCSE', 'U', 0, true);
    
    -- Senior Certificate NSC Higher Grade (HG)
    INSERT INTO public.symbol_points (organization_id, exam_level, symbol, points, active) VALUES
    (org_id, 'NSC_HG', 'A [80-100]', 7, true),
    (org_id, 'NSC_HG', 'B [70-79]', 6, true),
    (org_id, 'NSC_HG', 'C [60-69]', 5, true),
    (org_id, 'NSC_HG', 'D [50-59]', 4, true),
    (org_id, 'NSC_HG', 'E [40-49]', 3, true),
    (org_id, 'NSC_HG', 'F [33.3-39]', 2, true);
    
    -- Senior Certificate NSC Standard Grade (SG)
    INSERT INTO public.symbol_points (organization_id, exam_level, symbol, points, active) VALUES
    (org_id, 'NSC_SG', 'A [80-100]', 6, true),
    (org_id, 'NSC_SG', 'B [70-79]', 5, true),
    (org_id, 'NSC_SG', 'C [60-69]', 4, true),
    (org_id, 'NSC_SG', 'D [50-59]', 3, true),
    (org_id, 'NSC_SG', 'E [40-49]', 2, true),
    (org_id, 'NSC_SG', 'F [33.3-39]', 1, true);
    
  END IF;
END;
$function$;
