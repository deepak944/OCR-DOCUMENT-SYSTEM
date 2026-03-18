# System Architecture

## Overview

This document describes the architecture of the OCR Document Processing System with authentication and user management.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
│                      (React + Vite)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS (JWT Token in Header)
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    Backen