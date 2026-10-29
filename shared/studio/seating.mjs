const defaultSlots=['host','regular','rotating','guest-1'];
// Physical seat identity comes from the role, never persistence/selection order.
export function studioSeating(members,slots=defaultSlots.map(id=>({id}))){
 const order=slots.map(slot=>slot.id);
 return members.map(member=>({characterId:member.characterId,slotId:member.slotId,seatIndex:order.indexOf(member.slotId)})).filter(member=>member.seatIndex>=0&&member.seatIndex<4).sort((a,b)=>a.seatIndex-b.seatIndex);
}
