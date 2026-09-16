# N3XI0M

N3XI0M is a community-driven social gaming revival project focused on social play, creation, and community.

This repository contains the public N3XI0M website.

> This repository is for the website only.
> N3XI0M Rec.Net is still in development and will be released separately.

## Live Website

https://dragonet-recnet.pages.dev

## Community

Join the N3XI0M Discord:

https://discord.gg/9bFfM7Ppsz

## Project Status

The website is actively maintained.

Recent work includes:

- HTML structure repairs
- responsive and mobile improvements
- Discord statistics reliability improvements
- accessibility fixes
- SEO and social-preview metadata
- sitemap improvements
- automated regression testing
- GitHub Actions validation

## Website Structure

Key public pages include:

- `index.html` — homepage
- `download.html` — launcher and download information
- `jointheclub.html` — Discord and community access
- `TRAILER.html` — project trailer
- `discord-stats.html` — Discord statistics
- `dch.html` — DCH / Drewcotech information
- `status.html` — hosting and server status
- `support.html` — support information
- `support-us.html` — ways to support the project
- `rec.net.html` — Rec.Net coming-soon page
- `404.html` — custom error page

## Cloudflare Pages

The site is deployed through Cloudflare Pages.

The Discord statistics endpoint is implemented in `functions/stats.js`.

It retrieves approximate member and online counts from Discord and includes timeout, upstream-error, and malformed-response handling.

## Development

Clone the repository:

    git clone https://github.com/moldyfireAS/Dragonet-Nex-Rec.git
    cd Dragonet-Nex-Rec

Create a branch for your changes:

    git switch -c your-branch-name

Avoid making feature or bug-fix changes directly on `main`.

## Validation

Before opening a pull request, run:

    python scripts/audit_site.py
    node --check functions/stats.js
    git diff --check

Expected audit result:

    SITE AUDIT PASSED: 11 HTML pages checked with 0 issues.

The site auditor checks for:

- invalid HTML document structure
- missing required metadata
- missing canonical links
- missing Open Graph metadata
- duplicate IDs
- missing image alt text
- invalid list and link nesting
- unsafe `_blank` links
- insecure HTTP URLs
- missing local assets
- `robots.txt` configuration
- sitemap XML validity
- required project files

## Continuous Integration

GitHub Actions automatically validates changes on pushes and pull requests.

Workflow:

    .github/workflows/site-audit.yml

Changes should not be merged when required checks are failing.

## Contribution Workflow

Recommended workflow:

    main
      └── feature/fix branch
            └── pull request
                  └── CI checks
                        └── review
                              └── merge

Pull requests should include:

- a clear title
- a useful description
- a summary of testing performed
- screenshots for major visual changes
- confirmation that validation passes

## Commit Format

Commits should contain both a short title and a useful description.

Example:

    git commit \
      -m "fix(ui): improve responsive layout" \
      -m "Improve mobile behavior, repair layout issues, and preserve the existing visual design."

This also allows automated project notifications to display both the commit message and commit description.

## Branch Protection

The `main` branch should be protected.

Recommended rules:

- require pull requests before merging
- require at least one approval
- dismiss stale approvals after new commits
- require conversations to be resolved
- require CI checks to pass
- require the branch to be up to date
- block force pushes
- block branch deletion
- prevent direct pushes to `main`

> [!CAUTION]
> ## Security
>
> Never commit:

> - passwords
> - API tokens
> - Discord bot tokens
> - Cloudflare secrets
> - private keys
> - personal credentials
>
> If a credential is accidentally exposed, revoke and rotate it immediately.
>
> External links opened in new tabs should use `rel="noopener noreferrer"`.

## Accessibility

Current accessibility work includes:

- descriptive image alt text
- responsive viewport metadata
- screen-reader announcements for dynamic Discord statistics
- accessible trailer labeling
- decorative SVGs hidden from assistive technologies
- visually hidden contextual text

Accessibility regressions should be treated as bugs.

## SEO

Public pages include:

- canonical URLs
- page descriptions
- Open Graph metadata
- Twitter card metadata

The custom `404.html` page is excluded from search indexing.

The sitemap is available at `/sitemap.xml` and is advertised through `/robots.txt`.

## Maintainers

Original website development:

- **moldyfireAS / Moldy**

Bug fixing, hardening, accessibility, validation, and maintenance contributions:

- **tyl-droid / Nexi / Roxy**

## Credits

Thanks to everyone contributing to N3XI0M through development, testing, hosting, preservation, and community support.

---

N3XI0M is an independent community project.
