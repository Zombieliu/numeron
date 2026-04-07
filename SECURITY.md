# Security Policy

## Supported Scope

This repository is a template/starter, so security fixes focus on:

- dependency upgrades for template dependencies
- CI/CD and release workflow hardening
- shell/runtime trust boundaries between Next.js and Bevy WASM
- unsafe defaults that downstream projects could inherit

## Reporting

If you discover a security issue in this template, do not open a public issue
with exploit details first. Report it privately through GitHub security
advisories for the repository, or contact the maintainer directly if you control
the repo.

When reporting, include:

- affected file(s)
- attack surface
- impact on downstream users
- reproduction or proof-of-concept
- suggested mitigation if known

## Expectations

- template consumers are responsible for reviewing and customizing the generated
  app before production launch
- package IDs, signing config, auth flows, backend secrets, and deployment
  credentials must always be replaced per project
