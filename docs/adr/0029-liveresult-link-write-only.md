# LiveResult.link is write-only on the API

`LiveResult` stores an optional URL (`link`) as internal metadata. We deliberately never return it in any API response (GET collection, PUT response, PATCH response) and PUT ignores it even if provided. Only POST (at creation) and PATCH (partial update) accept it.

The field is operational data for writers — it has no scoring or display semantics and is not intended for public consumers. Exposing it would widen the public contract unnecessarily and invite accidental coupling to what is meant to be an internal detail. Writers that set it already know its value; readers have no use for it.
