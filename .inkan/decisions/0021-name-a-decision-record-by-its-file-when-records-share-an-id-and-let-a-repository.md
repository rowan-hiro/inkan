# 21. Name a decision record by its file when records share an id, and let a repository set where numbering starts

Date: 2026-09-28

## Status

Accepted

## Context and Problem Statement

Issue #2, filed on 2026-09-28 against 0.8.0: a derived repository carries upstream's history beneath its own commits and takes upstream's changes by rebase. Both number decision records as the highest id present plus one. The derived repository had its own 0013 to 0017; upstream, which had stopped at 0012, added its own 0013, and after the rebase the derived repository held two different records numbered 0013. doctor reported the duplicate, decision show printed only the first file, and an outcome bound by --decision 0013 in either repository named an ambiguous record. Neither the records nor the outcome logs may be edited to tell them apart, and upstream's next records, 0014 to 0017, will collide again, because upstream cannot know which numbers the derived repository has used.

## Decision Drivers

* Decision records and outcome files are never rewritten, renamed, or renumbered (0005, and the rule that Context and Decision are never edited)
* No cross-lineage reconciliation or repair tooling (0002)
* A link made before a collision keeps naming the record it was made against
* Records written with the new link data stay readable by earlier Inkan releases, and every existing contract hash stands, as with the follow links in 0020
* A repository without shared ids sees no change in how it names or numbers records

## Considered Options

* Rename or renumber the colliding records with a repair command
* Take an explicit id on decision add (--id), refused when taken
* Prefix a repository's ids with a namespace, such as ds-0013
* Give decision records random ids, as 0002 gives outcomes
* Name a record by its file when records share an id, and let a repository set where numbering starts

## Decision Outcome

The subject of this record is how decision records are named and numbered. A record's number stays its id, and its file name, NNNN-slug.md, is its full name. Wherever a command takes a decision id, it also takes the file name, with or without .md, or a unique prefix of one that includes the id. A read with an id that several records carry shows every one of them: decision show prints each after its path, and status and log <id> print a link that names no single record as ambiguous, with the number of records. A write refuses such an id and names each file: begin --decision, amend --decision, and decision update. begin and amend record, in an optional decisionFiles list on the event, the file each link resolved to. A link then resolves through its file, even after another record with its number arrives, and a recorded file that is gone prints as missing, as 0017 has it. decisionFiles stays out of the contract hash, like the lane tag and the follow links, so every earlier hash stands and Inkan 0.8.0 reads a record that carries it. log --decision with an id keeps every outcome linked to that id; with a file name, it keeps the outcomes whose link resolves to that file. doctor reports each shared id once, with every file that carries it and the way out, and still exits 1: two records under one number are a real divergence that Inkan does not repair (0002), and a repository that lives with it decides so itself. To number new records apart, a repository commits .inkan/config.json with decisionStart, an integer from 1 to 9999; decision add then gives a new record the larger of decisionStart and the highest id present plus one. The file refuses unknown settings, so a misspelt key cannot leave numbering unchanged without notice. A derived repository sets it in its own commits, which upstream never carries. Rejected: a repair command renames records and rewrites links, against 0002 and the rule that records are never rewritten. An explicit --id leaves the range to be remembered at every add. A namespace prefix changes the id grammar in every reader and still leaves the numbers already used colliding. Random ids would end the numbered sequence that prose cites as decision 0013.

## Consequences

* Upstream's next records can still collide with numbers the derived repository used before it set decisionStart; each such collision is readable and named, and there are at most as many as the numbers already used
* An outcome sealed before decision files were recorded that links a shared id stays ambiguous; that is missing information, not a wrong link
* doctor exits 1 in a repository that holds a shared id for as long as both records remain
* The library result of decisionShow gains records, and sets file and content only when one record matches
* A record's file name is now part of how outcomes refer to it, so a record renamed by hand leaves the links recorded against its old name missing

## Decision History
