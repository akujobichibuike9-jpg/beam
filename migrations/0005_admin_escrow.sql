-- Encrypted rooms: the room key sealed to the admin key, and each file's sealed key/details.
ALTER TABLE rooms ADD COLUMN escrow TEXT;
ALTER TABLE files ADD COLUMN fk TEXT;
ALTER TABLE files ADD COLUMN meta TEXT;
