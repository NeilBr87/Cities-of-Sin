import { useMemo, useState } from 'react';
import ChatPanel from '../components/ChatPanel';
import { Tabs } from '../components/ui';
import { useCharacter } from '../state/SessionProvider';

export default function Chat() {
  const { character, city, district } = useCharacter();

  // Channels are derived from who and where you are — never stored as a
  // membership. The server derives them again in can_read_channel().
  const channels = useMemo(() => {
    const list = [
      { id: 'global', label: 'Everywhere' },
      { id: `city:${city.id}`, label: city.name },
    ];
    if (character.jailed && character.jail_city_id) {
      list.push({ id: `prison:${character.jail_city_id}`, label: 'The Block' });
    } else {
      list.push({ id: `district:${district.id}`, label: district.name });
    }
    return list;
  }, [city.id, city.name, district.id, district.name, character.jailed, character.jail_city_id]);

  const [active, setActive] = useState(channels[0]!.id);
  const current = channels.some((c) => c.id === active) ? active : channels[0]!.id;

  return (
    <>
      <h1>Chat</h1>
      <Tabs tabs={channels} active={current} onChange={setActive} />
      <ChatPanel channel={current} />
    </>
  );
}
