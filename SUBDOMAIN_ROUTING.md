## Subdomain Routing Implementation Guide

### Overview
Enable each VTC organization to have their own subdomain: `{organization}.nvtc.app`

### Database Schema Update
Add subdomain field to organizations:
```sql
ALTER TABLE public.organizations 
ADD COLUMN subdomain TEXT UNIQUE;

-- Create index for fast lookups
CREATE INDEX idx_organizations_subdomain ON public.organizations(subdomain);

-- Add constraint to ensure valid subdomains
ALTER TABLE public.organizations
ADD CONSTRAINT valid_subdomain CHECK (subdomain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$');
```

### Frontend Implementation

#### 1. Subdomain Detection Utility
Create `src/lib/subdomainRouter.ts`:
```typescript
export interface SubdomainInfo {
  subdomain: string | null;
  isSubdomain: boolean;
  organizationId: string | null;
}

export async function getSubdomainInfo(): Promise<SubdomainInfo> {
  const hostname = window.location.hostname;
  
  // Development environments
  if (hostname === 'localhost' || hostname.includes('127.0.0.1')) {
    return { subdomain: null, isSubdomain: false, organizationId: null };
  }
  
  // Lovable preview
  if (hostname.includes('lovable.app')) {
    return { subdomain: null, isSubdomain: false, organizationId: null };
  }
  
  // Production subdomains
  const parts = hostname.split('.');
  
  // Root domain (nvtc.app)
  if (parts.length === 2) {
    return { subdomain: null, isSubdomain: false, organizationId: null };
  }
  
  // Subdomain (org.nvtc.app)
  if (parts.length >= 3) {
    const subdomain = parts[0];
    
    // Fetch organization by subdomain
    const { data } = await supabase
      .from('organizations')
      .select('id')
      .eq('subdomain', subdomain)
      .single();
    
    return {
      subdomain,
      isSubdomain: true,
      organizationId: data?.id || null,
    };
  }
  
  return { subdomain: null, isSubdomain: false, organizationId: null };
}
```

#### 2. Subdomain Context Provider
Update `OrganizationProvider` to detect subdomains:
```typescript
useEffect(() => {
  const initializeFromSubdomain = async () => {
    const subdomainInfo = await getSubdomainInfo();
    
    if (subdomainInfo.isSubdomain && subdomainInfo.organizationId) {
      setOrganizationId(subdomainInfo.organizationId);
      // Fetch rest of organization data...
    }
  };
  
  initializeFromSubdomain();
}, []);
```

#### 3. Auth Page Customization
Show organization branding on login:
```typescript
// In Auth.tsx
const { organizationId, settings } = useOrganizationContext();

return (
  <div className="auth-page">
    {settings?.logo_url && (
      <img src={settings.logo_url} alt="Organization Logo" />
    )}
    <h1>{organizationName || "VTC Management System"}</h1>
    {/* Login form */}
  </div>
);
```

### DNS Configuration

#### Wildcard DNS Setup
At your domain registrar (e.g., Cloudflare, GoDaddy):

1. **Add wildcard A record**:
   ```
   Type: A
   Name: *
   Value: [Vercel IP]
   TTL: Auto
   ```

2. **Add root A record**:
   ```
   Type: A
   Name: @
   Value: [Vercel IP]
   TTL: Auto
   ```

3. **Or use CNAME** (preferred for Vercel):
   ```
   Type: CNAME
   Name: *
   Value: cname.vercel-dns.com
   TTL: Auto
   ```

### Vercel Configuration

#### vercel.json
```json
{
  "rewrites": [
    {
      "source": "/:path*",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/:path*",
      "headers": [
        {
          "key": "X-Subdomain",
          "value": "$host"
        }
      ]
    }
  ]
}
```

#### Add Domains in Vercel
1. Go to Project Settings → Domains
2. Add root domain: `nvtc.app`
3. Add wildcard: `*.nvtc.app`
4. Vercel will auto-provision SSL for all subdomains

### Organization Setup Flow

#### 1. During Organization Creation
```typescript
const createOrganization = async (name: string) => {
  // Generate subdomain from name
  const subdomain = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/^-+|-+$/g, '');
  
  // Check availability
  const { data: existing } = await supabase
    .from('organizations')
    .select('id')
    .eq('subdomain', subdomain)
    .single();
  
  if (existing) {
    throw new Error('Subdomain already taken');
  }
  
  // Create organization with subdomain
  const { data } = await supabase
    .from('organizations')
    .insert({ name, subdomain })
    .select()
    .single();
  
  return data;
};
```

#### 2. Subdomain Availability Check
```typescript
export const useCheckSubdomain = () => {
  return useMutation({
    mutationFn: async (subdomain: string) => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id')
        .eq('subdomain', subdomain)
        .maybeSingle();
      
      return { available: !data, exists: !!data };
    },
  });
};
```

### Routing Logic

#### App.tsx with Subdomain Routing
```typescript
function App() {
  const [subdomainInfo, setSubdomainInfo] = useState<SubdomainInfo | null>(null);
  
  useEffect(() => {
    getSubdomainInfo().then(setSubdomainInfo);
  }, []);
  
  if (!subdomainInfo) {
    return <LoadingScreen />;
  }
  
  // On subdomain, skip org selection
  if (subdomainInfo.isSubdomain) {
    return (
      <OrganizationProvider initialOrgId={subdomainInfo.organizationId}>
        <SubdomainRoutes />
      </OrganizationProvider>
    );
  }
  
  // On root domain, show all organizations
  return (
    <OrganizationProvider>
      <RootRoutes />
    </OrganizationProvider>
  );
}
```

### Testing Subdomains Locally

#### Using /etc/hosts
Add entries to test locally:
```
127.0.0.1 nvtc.local
127.0.0.1 nairobi.nvtc.local
127.0.0.1 mombasa.nvtc.local
```

Then access:
- http://nvtc.local:5173
- http://nairobi.nvtc.local:5173

#### Update Vite config
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    host: 'nvtc.local',
    port: 5173,
  },
});
```

### Security Considerations

#### 1. Subdomain Validation
- Only allow lowercase alphanumeric and hyphens
- Min 3 characters, max 63 characters
- Can't start/end with hyphen
- Check against reserved subdomains

#### 2. Reserved Subdomains
```typescript
const RESERVED_SUBDOMAINS = [
  'www', 'api', 'admin', 'dashboard', 'app',
  'mail', 'ftp', 'localhost', 'staging',
  'dev', 'test', 'demo', 'beta',
];

function isSubdomainReserved(subdomain: string): boolean {
  return RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase());
}
```

#### 3. SSL/TLS
- Vercel handles SSL automatically for `*.nvtc.app`
- Certificates auto-renewed
- Force HTTPS in production

### Monitoring Subdomain Usage

```sql
-- Track subdomain access
CREATE TABLE subdomain_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  subdomain TEXT,
  visit_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Log access
CREATE OR REPLACE FUNCTION log_subdomain_access(
  _subdomain TEXT
) RETURNS void AS $$
BEGIN
  INSERT INTO subdomain_analytics (organization_id, subdomain, visit_count)
  SELECT id, _subdomain, 1
  FROM organizations
  WHERE subdomain = _subdomain
  ON CONFLICT (subdomain)
  DO UPDATE SET
    visit_count = subdomain_analytics.visit_count + 1,
    last_accessed = now();
END;
$$ LANGUAGE plpgsql;
```

### Migration Path

#### For Existing Organizations
```sql
-- Generate subdomains for existing orgs
UPDATE organizations
SET subdomain = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '-', 'g'))
WHERE subdomain IS NULL;

-- Handle duplicates
WITH numbered AS (
  SELECT 
    id,
    subdomain,
    ROW_NUMBER() OVER (PARTITION BY subdomain ORDER BY created_at) as rn
  FROM organizations
)
UPDATE organizations o
SET subdomain = n.subdomain || '-' || n.rn
FROM numbered n
WHERE o.id = n.id AND n.rn > 1;
```

### Troubleshooting

#### Subdomain Not Resolving
1. Check DNS propagation: `nslookup subdomain.nvtc.app`
2. Verify wildcard DNS record
3. Clear browser DNS cache
4. Wait 24-48 hours for full propagation

#### Organization Not Loading
1. Verify subdomain exists in database
2. Check organization is active
3. Review browser console for errors
4. Check network tab for API calls

#### SSL Certificate Issues
1. Verify domain added in Vercel
2. Check DNS points to Vercel
3. Allow 24 hours for certificate provisioning
4. Contact Vercel support if persists

---

**Implementation Priority**: High
**Complexity**: Medium
**Dependencies**: DNS Configuration, Vercel Setup
**Testing Required**: Yes (local /etc/hosts testing)
