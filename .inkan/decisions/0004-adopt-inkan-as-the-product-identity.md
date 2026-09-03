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
