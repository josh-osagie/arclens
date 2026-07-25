---
title: Introduction
description: What Arclens is, who it is for, and what problems it solves.
---

Arclens is an interactive architecture explorer for React and TypeScript applications.

It statically analyzes a codebase and transforms it into an interactive graph, helping engineers understand how components, hooks, services, utilities, contexts, and feature modules relate to one another.

Instead of manually navigating hundreds of files, Arclens provides a visual map of the application's architecture.

## The problem

Modern React applications become difficult to understand as they grow. Developers frequently ask questions like:

- Where does this feature start?
- Which files use this component?
- What will break if I change this file?
- How is this module connected to the rest of the application?
- Which components are tightly coupled?

Existing IDE navigation is file-centric. Arclens provides **architecture-centric** navigation.

## Who it is for

- Frontend and full-stack engineers
- Staff engineers reviewing unfamiliar code
- Open source maintainers onboarding contributors
- Engineering managers mapping feature ownership
- New team members ramping on large codebases

## Goals
Arclens is not perfect yet, but it aims to be a comprehensive tool for understanding and analyzing React codebases.

- Understand unfamiliar codebases quickly
- Visualize architectural relationships
- Identify dependencies before refactoring
- Reduce onboarding time
- Improve confidence when changing shared modules

## What Arclens is not

Arclens is **not** an IDE, AI code editor, bundler, linter, or performance profiler. It is a read-only analysis and exploration tool, your code is parsed with ts-morph and never executed.

## MVP capabilities

Arclens today can:

- Scan a React/TypeScript project
- Detect components, hooks, contexts, and utilities
- Build dependency relationships (imports, renders, hook uses)
- Generate `graph.json` for the viewer
- Visualize relationships with search and node details
- Surface optional architecture insights (orphans, naming, Rules of Hooks)

## Success metric

A developer should understand the architecture of an unfamiliar React application within few minutes.

## Future vision

Arclens is evolving toward a code intelligence platform with architecture health reports, impact analysis, circular dependency detection, dead code discovery, AI-assisted exploration, git history integration, and monorepo support. See the [Roadmap](../../../../roadmap.md) for current progress.
