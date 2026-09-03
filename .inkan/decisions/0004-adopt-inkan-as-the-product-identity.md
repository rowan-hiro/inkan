# 4. Adopt Inkan as the product identity

Date: 2026-09-03

## Status

Accepted

## Context and Problem Statement

The rewrite needed a name distinct from DriftSeal. Every single English word considered (tally, keel, cairn, oath, sworn, kept, stele, datum, ballast, and others) was already taken on npm. The old short alias `ds` read as DeepSeek, so any two-letter alias risked the same confusion.

## Decision Drivers

* Distinct from DriftSeal
* Free on npm and absent as a common shell command
* A word alias rather than two letters
* Meaning tied to sealing

## Considered Options

* sealstone
* tallymark
* fixity
* inkan
* minutebook
* waxseal

## Decision Outcome

Inkan, from 印鑑, a registered seal. npm package `inkan`; commands `inkan` and the alias `ink`, both accepting identical arguments. First release 0.1.0 as a new product line, not DriftSeal 4.

Storage lives under `.inkan/`, the commit trailer is `Inkan-Outcome`, the AGENTS.md markers are `<!-- inkan -->` and `<!-- /inkan -->`, and the companion skill is `use-inkan`.

## Consequences

* Docs, code, trailers, and the protocol block use only the Inkan names
* Nothing answers to the DriftSeal names or reads DriftSeal storage

## Decision History

### 2026-09-03T07:44:26.752Z, outcome 2026-09-03-0744-bqs8

Status: accepted -> accepted

npm refused the unscoped name on 2026-09-03: E403, package name too similar to existing packages ink and nan. The package is published as @hiro/inkan under Hiro's npm org. The product name, the inkan and ink commands, the .inkan/ directory, and the Inkan-Outcome trailer are unchanged.

### 2026-09-03T07:57:22.735Z, outcome 2026-09-03-0757-v9t1

Status: accepted -> accepted

Scope changed to @rowan-hiro/inkan on 2026-09-03, matching the GitHub owner rowan-hiro. Everything else in the previous entry stands.
