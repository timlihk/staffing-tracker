# Custom Domain Setup Guide

This guide explains how to configure the custom domain `asia-cm.team` for the Staffing Tracker application hosted on Railway.

## Domain Configuration

- **Frontend**: `https://asia-cm.team` and `https://www.asia-cm.team`
- **Backend API**: `https://api.asia-cm.team`
- **DNS Provider**: Cloudflare
- **Hosting**: Railway

---

## Step 1: Configure Custom Domains in Railway

### Frontend Service

1. Log into [Railway](https://railway.app)
2. Navigate to your staffing-tracker project
3. Click on the **frontend** service
4. Go to **Settings** tab
5. Scroll to **Domains** section
6. Click **+ Custom Domain** and add:
   - `asia-cm.team`
   - `www.asia-cm.team`
7. Railway will provide target domains (e.g., `frontend-production-xxxx.up.railway.app`)
8. Copy these target domains for DNS configuration

### Backend Service

1. In the same Railway project, click on the **backend** service
2. Go to **Settings** tab
3. Scroll to **Domains** section
4. Click **+ Custom Domain** and add:
   - `api.asia-cm.team`
5. Railway will provide a target domain (e.g., `backend-production-xxxx.up.railway.app`)
6. Copy this target domain for DNS configuration

---

## Step 2: Configure DNS in Cloudflare

1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select the `asia-cm.team` domain
3. Go to **DNS** → **Records**
4. Add the following CNAME records:

### DNS Records

| Type  | Name | Target | Proxy Status | TTL |
|-------|------|--------|--------------|-----|
| CNAME | @ | `<frontend-target-from-railway>` | ✅ Proxied | Auto |
| CNAME | www | `<frontend-target-from-railway>` | ✅ Proxied | Auto |
| CNAME | api | `<backend-target-from-railway>` | ✅ Proxied | Auto |

**Example:**
```
CNAME @ frontend-production-abc123.up.railway.app (Proxied)
CNAME www frontend-production-abc123.up.railway.app (Proxied)
CNAME api backend-production-xyz789.up.railway.app (Proxied)
```

**Important:** Enable the orange cloud (Proxied) for all records. This provides:
- Cloudflare CDN for faster content delivery
- Automatic SSL/TLS certificates
- DDoS protection
- Additional security features

---

## Step 3: Configure Environment Variables

### Frontend Service in Railway

1. Click on your **frontend** service in Railway
2. Go to **Variables** tab
3. Add the following variable:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://api.asia-cm.team/api`
4. The service will automatically redeploy with the new configuration

### Backend Service in Railway

1. Click on your **backend** service in Railway
2. Go to **Variables** tab
3. Add/update the following variable:
   - **Key**: `FRONTEND_URL`
   - **Value**: `https://asia-cm.team`
4. The service will automatically redeploy with the new configuration

**Note:** The `FRONTEND_URL` is used for CORS (Cross-Origin Resource Sharing) configuration, allowing your frontend to communicate with the backend API.

---

## Step 4: SSL/TLS Configuration (Cloudflare)

Cloudflare automatically provides SSL certificates when you enable the proxy (orange cloud).

### Recommended SSL/TLS Settings:

1. In Cloudflare, go to **SSL/TLS** tab
2. Set encryption mode to **Full (strict)** or **Full**
   - **Full (strict)**: Requires a valid SSL certificate on Railway (recommended)
   - **Full**: Accepts any SSL certificate on Railway
3. Enable **Always Use HTTPS** under SSL/TLS → Edge Certificates
4. Enable **Automatic HTTPS Rewrites**

---

## Step 5: Verification

### DNS Propagation

After adding DNS records, it typically takes 5-10 minutes for changes to propagate. You can check propagation status at:
- [DNS Checker](https://dnschecker.org)
- `dig asia-cm.team` (command line)
- `nslookup asia-cm.team` (command line)

### Testing Your Setup

Once DNS has propagated, test the following URLs:

1. **Frontend (Root Domain)**
   ```
   https://asia-cm.team
   ```
   Expected: Application homepage loads

2. **Frontend (www subdomain)**
   ```
   https://www.asia-cm.team
   ```
   Expected: Application homepage loads (same as root)

3. **Backend API Health Check**
   ```
   https://api.asia-cm.team/api/health
   ```
   Expected: JSON response indicating API is healthy

4. **Test Login**
   - Navigate to `https://asia-cm.team/login`
   - Try logging in with valid credentials
   - Verify API calls work correctly (check browser console)

---

## Troubleshooting

### Issue: "Too Many Redirects" Error

**Cause:** SSL/TLS encryption mode mismatch between Cloudflare and Railway

**Solution:**
1. Go to Cloudflare → SSL/TLS
2. Change encryption mode to **Full** (not Flexible, not Full (strict))
3. Wait a few minutes and try again

### Issue: API Calls Failing (CORS Errors)

**Cause:** CORS not properly configured or wrong `FRONTEND_URL`

**Solution:**
1. Check Railway backend environment variables
2. Verify `FRONTEND_URL` is set to `https://asia-cm.team` (no trailing slash)
3. Redeploy the backend service
4. Check browser console for specific CORS error messages

### Issue: 404 Not Found on Page Refresh

**Cause:** Frontend routing not configured for single-page applications

**Solution:**
Railway should automatically handle this for Vite apps, but if issues persist:
1. Ensure your frontend build includes proper routing configuration
2. Check Railway deployment logs for errors

### Issue: Domain Not Resolving

**Cause:** DNS records not properly configured or not yet propagated

**Solution:**
1. Verify CNAME records in Cloudflare DNS dashboard
2. Ensure target domains match exactly what Railway provides
3. Wait up to 24 hours for full DNS propagation (usually much faster)
4. Clear your browser cache and DNS cache:
   - Windows: `ipconfig /flushdns`
   - Mac: `sudo dscacheutil -flushcache`
   - Linux: `sudo systemd-resolve --flush-caches`

### Issue: Certificate Errors

**Cause:** SSL certificate not yet provisioned or misconfiguration

**Solution:**
1. Cloudflare provides instant SSL when using proxied (orange cloud) DNS
2. Verify all CNAME records have orange cloud enabled
3. Check Cloudflare SSL/TLS settings
4. If using Full (strict), ensure Railway has a valid certificate

---

## Maintenance

### Updating the Application

When deploying updates:
1. Push code to GitHub (Railway auto-deploys from main branch)
2. Railway will automatically rebuild and redeploy
3. Cloudflare CDN cache may need to be purged for immediate updates:
   - Go to Cloudflare → Caching → Purge Cache
   - Select "Purge Everything" (use sparingly)

### Monitoring

- **Railway Dashboard**: Monitor service health, logs, and deployment status
- **Cloudflare Analytics**: View traffic, performance, and security metrics
- **Uptime Monitoring**: Consider setting up uptime monitoring services like:
  - UptimeRobot (free)
  - Pingdom
  - Better Uptime

---

## Environment Variables Reference

### Frontend Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_API_URL` | `https://api.asia-cm.team/api` | Backend API endpoint |

### Backend Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `FRONTEND_URL` | `https://asia-cm.team` | Frontend URL for CORS |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `JWT_SECRET` | `<secret-key>` | JWT signing secret |
| `NODE_ENV` | `production` | Node environment |

---

## Security Recommendations

1. **Enable Cloudflare WAF (Web Application Firewall)**
   - Protects against common web attacks
   - Available on Cloudflare Pro plan and above

2. **Rate Limiting**
   - Configure rate limiting rules in Cloudflare
   - Protect login and API endpoints from brute force attacks

3. **Enable DNSSEC**
   - Go to Cloudflare → DNS → DNSSEC
   - Follow instructions to add DS record to your domain registrar

4. **Regular Security Headers**
   - Cloudflare automatically adds many security headers
   - Review and customize in Transform Rules if needed

5. **Monitor Access Logs**
   - Review Railway logs for suspicious activity
   - Enable Cloudflare logging for detailed traffic analysis

---

## Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Cloudflare DNS Documentation](https://developers.cloudflare.com/dns/)
- [Cloudflare SSL/TLS Documentation](https://developers.cloudflare.com/ssl/)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

---

## Support

For issues related to:
- **Domain & DNS**: Contact Cloudflare support
- **Hosting & Deployment**: Check Railway documentation or Discord community
- **Application Issues**: Review application logs in Railway dashboard

---

*Last Updated: 2025-10-04*
